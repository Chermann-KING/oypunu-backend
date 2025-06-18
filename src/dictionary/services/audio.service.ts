import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  duration: number;
}

const cloudinaryInstance = cloudinary as unknown as {
  config: (config: ConfigOptions) => void;
  uploader: {
    upload_stream: (
      options: any,
      callback: (error: Error | null, result: CloudinaryUploadResult) => void,
    ) => { end: (buffer: Buffer) => void };
    destroy: (id: string, options: any) => Promise<any>;
  };
  url: (id: string, options: any) => string;
};

@Injectable()
export class AudioService {
  constructor(private _configService: ConfigService) {
    const config: ConfigOptions = {
      cloud_name: this._configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this._configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this._configService.get<string>('CLOUDINARY_API_SECRET'),
    };
    cloudinaryInstance.config(config);
  }

  async uploadPhoneticAudio(
    word: string,
    language: string,
    audioBuffer: Buffer,
    accent: string = 'standard',
  ): Promise<{
    url: string;
    cloudinaryId: string;
    format: string;
    duration: number;
  }> {
    try {
      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const uploadStream = cloudinaryInstance.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: `phonetics/${language}/${accent}`,
              public_id: `${word}_${accent}`,
              format: 'mp3',
            },
            (error, result) => {
              if (error) reject(new Error(error.message));
              else resolve(result);
            },
          );
          uploadStream.end(audioBuffer);
        },
      );

      return {
        url: result.secure_url,
        cloudinaryId: result.public_id,
        format: result.format,
        duration: result.duration,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Erreur lors de l'upload audio: ${error.message}`);
      }
      throw new Error("Erreur inconnue lors de l'upload audio");
    }
  }

  async deletePhoneticAudio(cloudinaryId: string): Promise<void> {
    try {
      if (typeof cloudinaryInstance.uploader.destroy === 'function') {
        await cloudinaryInstance.uploader.destroy(cloudinaryId, {
          resource_type: 'video',
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `Erreur lors de la suppression audio: ${error.message}`,
        );
      }
      throw new Error('Erreur inconnue lors de la suppression audio');
    }
  }

  getAudioUrl(cloudinaryId: string): string {
    if (typeof cloudinaryInstance.url === 'function') {
      return cloudinaryInstance.url(cloudinaryId, {
        resource_type: 'video',
        format: 'mp3',
      });
    }
    throw new Error('Fonction url non disponible');
  }
}
