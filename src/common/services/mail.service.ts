import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private _transporter: nodemailer.Transporter;
  private readonly _logger = new Logger(MailService.name);

  constructor(private _configService: ConfigService) {
    // Vérifier si les variables d'environnement sont définies
    const mailHost = this._configService.get<string>("MAIL_HOST");
    const mailPort = this._configService.get<number>("MAIL_PORT");
    const mailUser = this._configService.get<string>("MAIL_USER");
    const mailPassword = this._configService.get<string>("MAIL_PASSWORD");
    const mailSecure =
      this._configService.get<string>("MAIL_SECURE") === "true";

    if (!mailHost || !mailPort || !mailUser || !mailPassword) {
      this._logger.warn(
        "Configuration d'email incomplète. Le service de mail sera désactivé."
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

      this._logger.log("Service de mail configuré avec succès");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `Erreur lors de la configuration du service de mail: ${errorMessage}`
      );
    }
  }

  async sendVerificationEmail(to: string, token: string, username: string) {
    if (!this._transporter) {
      this._logger.warn(
        "Tentative d'envoi d'email alors que le service est désactivé"
      );
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    const verificationLink = `${frontendUrl}/auth/verify-email/${token}`;

    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification de votre compte O'Ypunu</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 10px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 2.5em;
                color: #7c3aed;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .title {
                color: #1f2937;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
                font-size: 16px;
            }
            .verification-button {
                display: inline-block;
                background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                color: white !important;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
                transition: transform 0.2s;
            }
            .verification-button:hover {
                transform: translateY(-2px);
            }
            .verification-link {
                word-break: break-all;
                background-color: #f3f4f6;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                color: #6b7280;
                margin: 10px 0;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
            .highlight {
                background-color: #fef3c7;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🙂 O'Ypunu</div>
                <h1 class="title">Vérification de votre adresse email</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${username}</span>,</p>
                
                <p>Merci de vous être inscrit sur <strong>O'Ypunu</strong>, votre dictionnaire communautaire multilingue !</p>
                
                <p>Pour compléter votre inscription et activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" class="verification-button">
                        ✅ Vérifier mon adresse email
                    </a>
                </div>
                
                <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :</p>
                
                <div class="verification-link">
                    ${verificationLink}
                </div>
                
                <p><strong>⏰ Important :</strong> Ce lien de vérification expirera dans <span class="highlight">24 heures</span>.</p>
                
                <p>Si vous n'avez pas créé de compte sur O'Ypunu, vous pouvez ignorer cet email.</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
                <p style="font-size: 12px; color: #9ca3af;">
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to,
        subject: "🙂 Vérification de votre compte O'Ypunu",
        html: emailTemplate,
      });
      this._logger.log(
        `✅ Email de vérification envoyé à ${to} avec le nouveau template`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `❌ Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`
      );
    }
  }

  async sendPasswordResetEmail(to: string, token: string, username: string) {
    if (!this._transporter) {
      this._logger.warn(
        "Tentative d'envoi d'email alors que le service est désactivé"
      );
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    const resetLink = `${frontendUrl}/auth/reset-password/${token}`;

    const resetTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation de mot de passe O'Ypunu</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 10px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 2.5em;
                color: #dc2626;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .title {
                color: #1f2937;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
                font-size: 16px;
            }
            .reset-button {
                display: inline-block;
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                color: white !important;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
                transition: transform 0.2s;
            }
            .reset-button:hover {
                transform: translateY(-2px);
            }
            .reset-link {
                word-break: break-all;
                background-color: #f3f4f6;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                color: #6b7280;
                margin: 10px 0;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
            .highlight {
                background-color: #fef3c7;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
            }
            .warning {
                background-color: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔑 O'Ypunu</div>
                <h1 class="title">Réinitialisation de votre mot de passe</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${username}</span>,</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>O'Ypunu</strong>.</p>
                
                <p>Pour créer un nouveau mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" class="reset-button">
                        🔑 Réinitialiser mon mot de passe
                    </a>
                </div>
                
                <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :</p>
                
                <div class="reset-link">
                    ${resetLink}
                </div>
                
                <div class="warning">
                    <p><strong>⚠️ Important :</strong> Ce lien de réinitialisation expirera dans <span class="highlight">1 heure</span>.</p>
                    <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire collaboratif multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
                <p style="font-size: 12px; color: #9ca3af;">
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to,
        subject: "🔑 Réinitialisation de votre mot de passe O'Ypunu",
        html: resetTemplate,
      });
      this._logger.log(
        `✅ Email de réinitialisation de mot de passe envoyé à ${to} avec le nouveau template`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `❌ Erreur lors de l'envoi de l'email de réinitialisation: ${errorMessage}`
      );
    }
  }
}
