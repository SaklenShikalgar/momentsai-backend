# MomentsAI Backend

Ye backend teen kaam karta hai:
1. Photographer ki photos S3 me upload karta hai + Rekognition se unke chehre "index" karta hai
2. User ki selfie leke Rekognition se match dhundhta hai
3. Matching photos ke temporary download links wapas bhejta hai

## Setup (pehli baar)

1. Is poore `momentsai-backend` folder ko apne PC par kisi jagah rakho (Desktop pe rakh sakte ho, alag se — frontend wale folder se bahar).

2. VS Code me is folder ko open karo (File → Open Folder).

3. Terminal kholo (Ctrl + `) aur likho:
   ```
   npm install
   ```
   Isse saari zaroori files download ho jayengi.

4. `.env.example` file ko copy karke naam badal do `.env` rakho. Usme apni values daalo:
   - `AWS_ACCESS_KEY_ID` — jo IAM user banate waqt mila tha
   - `AWS_SECRET_ACCESS_KEY` — wahi wala secret key
   - `AWS_REGION` — jo region use kiya tha (jaise ap-south-1)
   - `S3_BUCKET_NAME` — apna bucket ka poora naam
   - `REKOGNITION_COLLECTION_ID` — jo collection banaya tha (jaise wedding-guest-faces)

5. Server chalao:
   ```
   npm start
   ```
   Terminal me dikhega: `✅ MomentsAI backend chal raha hai: http://localhost:5000`

6. Browser me `http://localhost:5000` kholo — "MomentsAI backend is running ✅" dikhna chahiye. Agar ye dikh gaya, matlab backend sahi chal raha hai.

## Testing (Postman ya browser se, frontend jodne se pehle)

### Photo upload test karna (Postman se)
- Method: POST
- URL: `http://localhost:5000/api/upload-photos`
- Body: form-data, key = `photos` (type: File), 1-2 photos select karo jisme chehre saaf dikhte hon
- Send karo — response me `facesIndexed` count dikhna chahiye (0 se zyada)

### Selfie search test karna (Postman se)
- Method: POST
- URL: `http://localhost:5000/api/search-selfie`
- Body: form-data, key = `selfie` (type: File), wahi chehre ki koi aur photo select karo
- Send karo — response me matching photo ka download link (`url`) milna chahiye

## Agla step
Jab dono APIs test me kaam kar jayen, tab frontend (React) ke fake "AI searching" wale part ko in real APIs se jodenge.
