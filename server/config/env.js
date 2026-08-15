/**
 * env.js — .env ফাইলগুলো সবার আগে load করে।
 *
 * কেন আলাদা ফাইল: ESM-এ সব `import` মূল ফাইলের body-র আগেই evaluate হয়। কিছু
 * module (যেমন middleware/auth.js, services/mlClient.js) module-load সময়ই
 * process.env পড়ে। তাই index.js-এর ভেতরে dotenv.config() ডাকলে সেটি অনেক দেরি
 * হয়ে যায় — ওই module গুলো তখন undefined পেয়ে fallback ব্যবহার করে ফেলে
 * (এতে sign আর verify আলাদা JWT secret পেয়ে সব protected route 401 দিত)।
 * index.js-এ এই ফাইলটিকে প্রথম import রাখলে env সবার আগে তৈরি হয়ে যায়।
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env.local') }); // root override file
dotenv.config({ path: path.join(__dirname, '../.env') }); // server/.env
