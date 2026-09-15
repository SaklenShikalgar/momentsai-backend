import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

const app = express();
app.use(cors());
app.use(express.json());

// Files aayenge memory me (RAM), disk par save nahi honge - seedha S3 jayenge
const upload = multer({ storage: multer.memoryStorage() });

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET_NAME;
const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID;

const awsCreds = {
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3 = new S3Client(awsCreds);
const rekognition = new RekognitionClient(awsCreds);

// ---------------------------------------------------------------------------
// Health check - browser me khol ke check kar sakte ho ki server chal raha hai
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("MomentsAI backend is running ✅");
});

// ---------------------------------------------------------------------------
// PHOTOGRAPHER: Ek ya multiple wedding photos upload karo
// - Har photo S3 me save hoti hai
// - Rekognition us photo ke saare chehre "index" karta hai
// - ExternalImageId = photo ka S3 key, isse hume pata chalega match kis photo me mila
// ---------------------------------------------------------------------------
app.post("/api/upload-photos", upload.array("photos", 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Koi photo nahi mili upload me" });
    }

    const results = [];

    for (const file of files) {
      // Rekognition ka ExternalImageId sirf letters/numbers/_/./-/: allow karta hai
      // (na slash, na space, na special characters) - isliye original filename
      // use nahi karte, ek clean UUID + safe extension banate hain
      const rawExt = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      const safeExt = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "jpg";
      const safeId = `${uuidv4()}.${safeExt}`; // e.g. "550e8400-...-446655440000.jpg"
      const key = `event-photos/${safeId}`;

      // Step 1: S3 me upload karo
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      // Step 2: Rekognition ko bolo isme se chehre nikaal ke collection me daalo
      let facesIndexed = 0;
      try {
        const indexResult = await rekognition.send(
          new IndexFacesCommand({
            CollectionId: COLLECTION_ID,
            Image: {
              S3Object: { Bucket: BUCKET, Name: key },
            },
            ExternalImageId: safeId, // isi se pata chalega ye face kis photo ka hai
            DetectionAttributes: [],
            MaxFaces: 20,
            QualityFilter: "AUTO",
          })
        );
        facesIndexed = indexResult.FaceRecords?.length || 0;
      } catch (rekErr) {
        // Agar photo me chehra hi nahi mila to bhi photo S3 me rahegi, bas index nahi hoga
        console.warn(`Face indexing failed for ${key}:`, rekErr.message);
      }

      results.push({ key, facesIndexed });
    }

    res.json({ message: "Upload complete", photos: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload me kuch gadbad hui", details: err.message });
  }
});

// ---------------------------------------------------------------------------
// USER: Selfie upload karo, matching wedding photos wapas milengi
// ---------------------------------------------------------------------------
app.post("/api/search-selfie", upload.single("selfie"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Selfie nahi mili" });
    }

    // Rekognition ko selfie bhejo, collection me match dhundhne ke liye
    const searchResult = await rekognition.send(
      new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: req.file.buffer },
        FaceMatchThreshold: 80, // 80%+ confidence wale hi match maanenge
        MaxFaces: 50,
      })
    );

    const matches = searchResult.FaceMatches || [];

    if (matches.length === 0) {
      return res.json({ message: "Koi matching photo nahi mili", photos: [] });
    }

    // Har match se photo ka S3 key nikalo (duplicate hata do, ek photo me multiple bar face ho sakta hai)
    // ExternalImageId me sirf filename tha (jaise "uuid.jpg"), folder prefix wapas jodna hai
    const matchedKeys = [
      ...new Set(matches.map((m) => `event-photos/${m.Face.ExternalImageId}`)),
    ];

    // Har photo ke liye ek temporary downloadable link (presigned URL) banao, 1 hour ke liye valid
    const photos = await Promise.all(
      matchedKeys.map(async (key) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: key }),
          { expiresIn: 3600 }
        ).catch(() => null);
        return { key, url };
      })
    );

    res.json({ message: "Matches mil gaye", photos });
  } catch (err) {
    console.error(err);
    if (err.name === "InvalidParameterException") {
      return res
        .status(400)
        .json({ error: "Selfie me koi chehra detect nahi hua, dusri photo try karo" });
    }
    res.status(500).json({ error: "Search me kuch gadbad hui", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ MomentsAI backend chal raha hai: http://localhost:${PORT}`);
});