import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private _transporter: nodemailer.Transporter;
  private readonly _logger = new Logger(MailService.name);

  constructor(private _configService: ConfigService) {
    // Vérifier si les variables d'environnement sont définies
    const mailHost = this._configService.get<string>('MAIL_HOST');
    const mailPort = this._configService.get<number>('MAIL_PORT');
    const mailUser = this._configService.get<string>('MAIL_USER');
    const mailPassword = this._configService.get<string>('MAIL_PASSWORD');
    const mailSecure =
      this._configService.get<string>('MAIL_SECURE') === 'true';

    if (!mailHost || !mailPort || !mailUser || !mailPassword) {
      this._logger.warn(
        "Configuration d'email incomplète. Le service de mail sera désactivé.",
      );
      return;
    }

    try {
      this._transporter = nodemailer.createTransport({
        host: mailHost,
        port: mailPort,
        secure: mailSecure,
        auth: {
          user: mailUser,
          pass: mailPassword,
        },
      });

      this._logger.log('Service de mail configuré avec succès');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de la configuration du service de mail: ${errorMessage}`,
      );
    }
  }

  async sendVerificationEmail(to: string, token: string, username: string) {
    if (!this._transporter) {
      this._logger.warn(
        "Tentative d'envoi d'email alors que le service est désactivé",
      );
      return;
    }

    const appUrl = this._configService.get<string>('APP_URL');
    const verificationLink = `${appUrl}/auth/verify-email/${token}`;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get('MAIL_FROM')}>`,
        to,
        subject: 'Vérification de votre adresse email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Bonjour ${username},</h2>
            <p>Merci de vous être inscrit sur O'Ypunu, votre dictionnaire social multilingue.</p>
            <p>Pour compléter votre inscription et activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
            <p style="margin: 20px 0;">
              <a href="${verificationLink}" style="background-color: #3490dc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Vérifier mon email</a>
            </p>
            <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
            <p>Ce lien est valable pendant 24 heures.</p>
            <p>L'équipe O'Ypunu</p>
          </div>
        `,
      });
      this._logger.log(`Email de vérification envoyé à ${to}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`,
      );
    }
  }

  async sendPasswordResetEmail(to: string, token: string, username: string) {
    if (!this._transporter) {
      this._logger.warn(
        "Tentative d'envoi d'email alors que le service est désactivé",
      );
      return;
    }

    const appUrl = this._configService.get<string>('APP_URL');
    const resetLink = `${appUrl}/auth/reset-password/${token}`;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get('MAIL_FROM')}>`,
        to,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Bonjour ${username},</h2>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Pour créer un nouveau mot de passe, veuillez cliquer sur le lien ci-dessous :</p>
            <p style="margin: 20px 0;">
              <a href="${resetLink}" style="background-color: #3490dc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a>
            </p>
            <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
            <p>Ce lien est valable pendant 1 heure.</p>
            <p>L'équipe O'Ypunu</p>
          </div>
        `,
      });
      this._logger.log(
        `Email de réinitialisation de mot de passe envoyé à ${to}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de l'envoi de l'email de réinitialisation: ${errorMessage}`,
      );
    }
  }
}
