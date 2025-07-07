import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

// Interfaces pour les templates d'emails
interface ContributorRequestConfirmationData {
  to: string;
  username: string;
  requestId: string;
}

interface ContributorRequestApprovedData {
  to: string;
  username: string;
  reviewerName: string;
  reviewNotes?: string;
}

interface ContributorRequestRejectedData {
  to: string;
  username: string;
  reviewerName: string;
  rejectionReason?: string;
  reviewNotes?: string;
}

interface ContributorRequestUnderReviewData {
  to: string;
  username: string;
  reviewerName: string;
  reviewNotes?: string;
}

interface ContributorWelcomeData {
  to: string;
  username: string;
  newRole: string;
  promotedAt: Date;
}

interface AdminNewContributorRequestData {
  to: string;
  adminName: string;
  applicantName: string;
  requestId: string;
  priority: string;
}

interface ContributorRequestReminderData {
  to: string;
  username: string;
  requestId: string;
  expiresAt: Date;
}

interface WeeklyContributorStatsData {
  to: string;
  adminName: string;
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    week: string;
  };
}

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

  // === MÉTHODES POUR LES DEMANDES DE CONTRIBUTION ===

  async sendContributorRequestConfirmation(data: ContributorRequestConfirmationData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demande de contribution reçue - O'Ypunu</title>
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
                color: #059669;
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
            .highlight {
                background-color: #ecfdf5;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #059669;
            }
            .info-box {
                background-color: #f0f9ff;
                border-left: 4px solid #0ea5e9;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">✍️ O'Ypunu</div>
                <h1 class="title">Demande de contribution reçue</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <p>Nous avons bien reçu votre demande pour devenir contributeur sur <strong>O'Ypunu</strong> !</p>
                
                <div class="info-box">
                    <p><strong>📋 Prochaines étapes :</strong></p>
                    <ul>
                        <li>Votre demande sera examinée par notre équipe d'administration</li>
                        <li>Vous recevrez une réponse par email sous <strong>3-5 jours ouvrables</strong></li>
                        <li>En cas d'acceptation, vous aurez accès aux outils de contribution</li>
                    </ul>
                </div>
                
                <p>Votre numéro de demande : <span class="highlight">${data.requestId}</span></p>
                
                <p>Merci pour votre intérêt à contribuer à la préservation et au partage des langues africaines ! 🌍</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "✍️ Votre demande de contribution a été reçue",
        html: emailTemplate,
      });
      this._logger.log(`✅ Email de confirmation de demande envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de l'email de confirmation: ${errorMessage}`);
    }
  }

  async sendContributorRequestApproved(data: ContributorRequestApprovedData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demande de contribution approuvée ! - O'Ypunu</title>
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
                color: #059669;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .title {
                color: #059669;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
                font-size: 16px;
            }
            .success-box {
                background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
                border: 2px solid #059669;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                text-align: center;
            }
            .action-button {
                display: inline-block;
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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
            .action-button:hover {
                transform: translateY(-2px);
            }
            .highlight {
                background-color: #ecfdf5;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #059669;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎉 O'Ypunu</div>
                <h1 class="title">Félicitations !</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <div class="success-box">
                    <h2 style="color: #059669; margin: 0 0 15px 0;">✅ Votre demande a été approuvée !</h2>
                    <p style="margin: 0; font-size: 18px; color: #047857;">Bienvenue dans l'équipe des contributeurs O'Ypunu !</p>
                </div>
                
                <p>Votre demande de contribution a été examinée et approuvée par <strong>${data.reviewerName}</strong>.</p>
                
                ${data.reviewNotes ? `
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p><strong>💬 Commentaires :</strong></p>
                    <p style="font-style: italic;">"${data.reviewNotes}"</p>
                </div>
                ` : ''}
                
                <p><strong>🚀 Vous pouvez maintenant :</strong></p>
                <ul>
                    <li>Ajouter de nouveaux mots au dictionnaire</li>
                    <li>Modérer les contributions d'autres utilisateurs</li>
                    <li>Participer à la gouvernance de la communauté</li>
                    <li>Accéder aux outils de contribution avancés</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${frontendUrl}/dictionary/add-word" class="action-button">
                        📝 Commencer à contribuer
                    </a>
                </div>
                
                <p>Merci de contribuer à la préservation et au partage des langues africaines ! 🌍</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "🎉 Votre demande de contribution a été approuvée !",
        html: emailTemplate,
      });
      this._logger.log(`✅ Email d'approbation envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de l'email d'approbation: ${errorMessage}`);
    }
  }

  async sendContributorRequestRejected(data: ContributorRequestRejectedData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mise à jour de votre demande de contribution - O'Ypunu</title>
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
            .highlight {
                background-color: #fef2f2;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #dc2626;
            }
            .info-box {
                background-color: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .action-button {
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
            .action-button:hover {
                transform: translateY(-2px);
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">📋 O'Ypunu</div>
                <h1 class="title">Mise à jour de votre demande</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <p>Votre demande de contribution a été examinée par <strong>${data.reviewerName}</strong>.</p>
                
                <div class="info-box">
                    <p><strong>🔍 Statut de votre demande :</strong> Non retenue pour le moment</p>
                </div>
                
                ${data.rejectionReason ? `
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p><strong>📝 Raison :</strong></p>
                    <p>${data.rejectionReason}</p>
                </div>
                ` : ''}
                
                ${data.reviewNotes ? `
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p><strong>💬 Commentaires :</strong></p>
                    <p style="font-style: italic;">"${data.reviewNotes}"</p>
                </div>
                ` : ''}
                
                <p><strong>💡 N'hésitez pas à :</strong></p>
                <ul>
                    <li>Continuer à utiliser O'Ypunu en tant qu'utilisateur</li>
                    <li>Participer aux communautés linguistiques</li>
                    <li>Nous faire part de vos suggestions d'amélioration</li>
                    <li>Repostuler plus tard avec plus d'expérience</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${frontendUrl}" class="action-button">
                        🌍 Continuer sur O'Ypunu
                    </a>
                </div>
                
                <p>Merci pour votre intérêt à contribuer à O'Ypunu ! 🙏</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "📋 Mise à jour de votre demande de contribution",
        html: emailTemplate,
      });
      this._logger.log(`✅ Email de rejet envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de l'email de rejet: ${errorMessage}`);
    }
  }

  async sendContributorRequestUnderReview(data: ContributorRequestUnderReviewData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Votre demande est en cours de révision - O'Ypunu</title>
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
                color: #0ea5e9;
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
            .highlight {
                background-color: #f0f9ff;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #0ea5e9;
            }
            .info-box {
                background-color: #f0f9ff;
                border-left: 4px solid #0ea5e9;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔍 O'Ypunu</div>
                <h1 class="title">Demande en cours de révision</h1>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <p>Votre demande de contribution est actuellement en cours de révision approfondie par <strong>${data.reviewerName}</strong>.</p>
                
                <div class="info-box">
                    <p><strong>🔍 Statut :</strong> En cours de révision</p>
                    <p>Nous prenons le temps nécessaire pour examiner votre profil et vos motivations.</p>
                </div>
                
                ${data.reviewNotes ? `
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p><strong>💬 Commentaires :</strong></p>
                    <p style="font-style: italic;">"${data.reviewNotes}"</p>
                </div>
                ` : ''}
                
                <p>Nous vous tiendrons informé de l'avancement et vous recevrez une réponse finale sous peu.</p>
                
                <p>Merci pour votre patience ! 🙏</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "🔍 Votre demande est en cours de révision",
        html: emailTemplate,
      });
      this._logger.log(`✅ Email de révision en cours envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de l'email de révision: ${errorMessage}`);
    }
  }

  async sendContributorWelcome(data: ContributorWelcomeData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue dans l'équipe O'Ypunu !</title>
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
                font-size: 3em;
                color: #7c3aed;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .title {
                color: #7c3aed;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 20px;
            }
            .welcome-badge {
                background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                color: white;
                padding: 15px 25px;
                border-radius: 50px;
                font-weight: 600;
                font-size: 18px;
                display: inline-block;
                margin: 20px 0;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
                font-size: 16px;
            }
            .action-button {
                display: inline-block;
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                color: white !important;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                margin: 10px 5px;
                transition: transform 0.2s;
            }
            .action-button:hover {
                transform: translateY(-2px);
            }
            .highlight {
                background-color: #f3e8ff;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #7c3aed;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎉 O'Ypunu</div>
                <h1 class="title">Bienvenue dans l'équipe !</h1>
                <div class="welcome-badge">🌟 ${data.newRole.toUpperCase()} 🌟</div>
            </div>
            
            <div class="content">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <p><strong>Félicitations !</strong> Vous êtes maintenant officiellement <strong>${data.newRole}</strong> sur O'Ypunu ! 🎊</p>
                
                <p><strong>🚀 Vos nouveaux privilèges :</strong></p>
                <ul>
                    <li>✅ Ajouter et modifier des mots dans le dictionnaire</li>
                    <li>✅ Modérer les contributions d'autres utilisateurs</li>
                    <li>✅ Accéder aux outils de contribution avancés</li>
                    <li>✅ Participer à la gouvernance de la communauté</li>
                    <li>✅ Aider à préserver les langues africaines</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${frontendUrl}/dictionary/add-word" class="action-button">
                        📝 Ajouter mon premier mot
                    </a>
                    <a href="${frontendUrl}/admin/dashboard" class="action-button">
                        🎛️ Tableau de bord admin
                    </a>
                </div>
                
                <p><strong>🌍 Votre mission :</strong> Contribuer à faire d'O'Ypunu la plus grande ressource de langues africaines au monde !</p>
                
                <p>Nous sommes ravis de vous compter parmi nous. Ensemble, préservons et partageons nos langues ! 💪</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
                <p style="font-size: 12px; color: #9ca3af;">
                    Promotion effectuée le ${new Date(data.promotedAt).toLocaleDateString('fr-FR')}
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "🎉 Bienvenue dans l'équipe O'Ypunu !",
        html: emailTemplate,
      });
      this._logger.log(`✅ Email de bienvenue contributeur envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de l'email de bienvenue: ${errorMessage}`);
    }
  }

  async sendAdminNewContributorRequest(data: AdminNewContributorRequestData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    const adminUrl = `${frontendUrl}/admin/contributor-requests`;
    
    const priorityColors = {
      low: '#6b7280',
      medium: '#0ea5e9',
      high: '#f59e0b',
      urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[data.priority as keyof typeof priorityColors] || '#6b7280';
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle demande de contribution - O'Ypunu Admin</title>
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
            .priority-badge {
                background-color: ${priorityColor};
                color: white;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .action-button {
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
            .action-button:hover {
                transform: translateY(-2px);
            }
            .highlight {
                background-color: #f3e8ff;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #7c3aed;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔔 O'Ypunu Admin</div>
                <h1 style="color: #1f2937; font-size: 24px; font-weight: 600; margin-bottom: 10px;">
                    Nouvelle demande de contribution
                </h1>
                <span class="priority-badge">${data.priority}</span>
            </div>
            
            <div style="color: #4b5563; font-size: 16px;">
                <p>Bonjour <span class="highlight">${data.adminName}</span>,</p>
                
                <p>Une nouvelle demande de contribution a été soumise et nécessite votre attention.</p>
                
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>👤 Candidat :</strong> ${data.applicantName}</p>
                    <p><strong>🆔 ID de la demande :</strong> ${data.requestId}</p>
                    <p><strong>⚡ Priorité :</strong> <span style="color: ${priorityColor}; font-weight: 600;">${data.priority.toUpperCase()}</span></p>
                    <p><strong>📅 Reçue le :</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${adminUrl}" class="action-button">
                        🔍 Examiner la demande
                    </a>
                </div>
                
                <p>Merci de traiter cette demande dans les meilleurs délais.</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu Admin</strong> - Système de gestion<br>
                    <a href="${adminUrl}" style="color: #7c3aed;">Tableau de bord admin</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu Admin" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: `🔔 Nouvelle demande de contribution (${data.priority.toUpperCase()})`,
        html: emailTemplate,
      });
      this._logger.log(`✅ Notification admin envoyée à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi de la notification admin: ${errorMessage}`);
    }
  }

  async sendContributorRequestReminder(data: ContributorRequestReminderData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    const daysLeft = Math.ceil((new Date(data.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rappel - Votre demande de contribution expire bientôt</title>
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
                color: #f59e0b;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .warning-box {
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .highlight {
                background-color: #fef3c7;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #f59e0b;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">⏰ O'Ypunu</div>
                <h1 style="color: #1f2937; font-size: 24px; font-weight: 600;">Rappel important</h1>
            </div>
            
            <div style="color: #4b5563; font-size: 16px;">
                <p>Bonjour <span class="highlight">${data.username}</span>,</p>
                
                <div class="warning-box">
                    <p><strong>⏰ Votre demande de contribution expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} !</strong></p>
                    <p>Numéro de demande : ${data.requestId}</p>
                </div>
                
                <p>Nous voulions vous informer que votre demande de contribution sur O'Ypunu n'a pas encore été traitée et expirera le <strong>${new Date(data.expiresAt).toLocaleDateString('fr-FR')}</strong>.</p>
                
                <p>Notre équipe examine les demandes par ordre de priorité. Si votre demande expire, vous pourrez en soumettre une nouvelle à tout moment.</p>
                
                <p>Merci pour votre patience et votre intérêt pour O'Ypunu ! 🙏</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu</strong> - Dictionnaire communautaire multilingue<br>
                    <a href="${frontendUrl}" style="color: #7c3aed;">Visitez notre site</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "⏰ Rappel : Votre demande de contribution expire bientôt",
        html: emailTemplate,
      });
      this._logger.log(`✅ Rappel d'expiration envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi du rappel: ${errorMessage}`);
    }
  }

  async sendWeeklyContributorStats(data: WeeklyContributorStatsData) {
    if (!this._transporter) {
      this._logger.warn("Tentative d'envoi d'email alors que le service est désactivé");
      return;
    }

    const frontendUrl = this._configService.get<string>("FRONTEND_URL");
    const adminUrl = `${frontendUrl}/admin/contributor-requests`;
    
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapport hebdomadaire - Demandes de contribution</title>
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
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin: 20px 0;
            }
            .stat-card {
                background-color: #f9fafb;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #e5e7eb;
            }
            .stat-number {
                font-size: 24px;
                font-weight: 700;
                color: #7c3aed;
            }
            .stat-label {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
            }
            .action-button {
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
            .action-button:hover {
                transform: translateY(-2px);
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 2.5em; color: #7c3aed; font-weight: bold; margin-bottom: 10px;">📊 O'Ypunu</div>
                <h1 style="color: #1f2937; font-size: 24px; font-weight: 600;">Rapport hebdomadaire</h1>
                <p style="color: #6b7280;">Semaine du ${data.stats.week}</p>
            </div>
            
            <div style="color: #4b5563; font-size: 16px;">
                <p>Bonjour ${data.adminName},</p>
                
                <p>Voici le résumé des demandes de contribution pour cette semaine :</p>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.total}</div>
                        <div class="stat-label">Total reçues</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.pending}</div>
                        <div class="stat-label">En attente</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.approved}</div>
                        <div class="stat-label">Approuvées</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.rejected}</div>
                        <div class="stat-label">Rejetées</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${adminUrl}" class="action-button">
                        📋 Voir toutes les demandes
                    </a>
                </div>
                
                <p>Merci pour votre gestion continue de la communauté O'Ypunu ! 🙏</p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>O'Ypunu Admin</strong> - Rapport automatique<br>
                    <a href="${adminUrl}" style="color: #7c3aed;">Tableau de bord admin</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this._transporter.sendMail({
        from: `"O'Ypunu Admin" <${this._configService.get("MAIL_FROM")}>`,
        to: data.to,
        subject: "📊 Rapport hebdomadaire - Demandes de contribution",
        html: emailTemplate,
      });
      this._logger.log(`✅ Rapport hebdomadaire envoyé à ${data.to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(`❌ Erreur lors de l'envoi du rapport hebdomadaire: ${errorMessage}`);
    }
  }
}
