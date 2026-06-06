# Image Upload Website

This is a simple web app that lets users upload images, stores them in Supabase Storage, and saves the public URL in a Supabase table.

## How to use
1. Open `index.html` in a browser.
2. Click **Choose File** and select an image.
3. Click **Upload** – the image will be uploaded to Supabase and a preview will appear.
4. The image URL is stored in the `image_meta` table, so anyone can view the image via its public link.

## Sharing with friends
- Host the `task2` folder on any static web server (GitHub Pages, Netlify, Vercel, etc.).
- Make sure the Supabase URL and anon key are set in `app.js` (they are already in the code). The same Supabase project is used by all visitors, so any friend can upload images.
- If you want to restrict uploads, configure Row Level Security in Supabase.

## Deploy
```bash
# Example with Vite (if you want a dev server)
npm create vite@latest task2 --template vanilla
# copy files into the generated folder and run
npm install
npm run dev
```

Enjoy uploading!
