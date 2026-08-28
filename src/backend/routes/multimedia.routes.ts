import { Router } from 'express';
import { MultimediaController } from '../controllers/multimedia.controller';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.post('/upload', upload.single('archivo'), MultimediaController.uploadFile);
router.get('/orden/:ordenId', MultimediaController.getFilesByOrden);

export default router;
