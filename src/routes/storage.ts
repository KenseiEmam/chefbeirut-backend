import express from "express";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION;

const s3 = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})



// 1. Generate Presigned URL for Upload
router.post('/presign-upload', async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) throw new Error('fileName and contentType required');

    const objectKey = `${randomUUID()}-${fileName}`;
    const publicFileUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${objectKey}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return res.json({presignedUrl,objectKey,publicFileUrl});
  } catch (error:any) {
    console.error('Presign Error:', error.message);
 res.status(500).json({ error: "Failed to prepare uploiad", details: error });
  
  }
});
router.post('/save-metadata', async (req, res) => {
  try {
    const { objectKey, publicFileUrl } = req.body

    if (!objectKey) throw new Error('objectKey required')
    if (!publicFileUrl) throw new Error('publicFileUrl required')

    const file = await prisma.s3File.create({
      data: {
        objectKey,
        fileUrl: publicFileUrl,
      },
    })

    console.log(`Metadata saved for S3 object: ${objectKey}`)
    return res.json(file)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'meta not found' })
    res.status(500).json({ error: err.message || 'Failed to run meta data save' })
  }
})


export default router;