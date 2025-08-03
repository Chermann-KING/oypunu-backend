/**
 * @fileoverview Contrôleur principal de l'application O'Ypunu
 * 
 * Ce contrôleur gère les endpoints racine de l'API, notamment la page d'accueil
 * avec documentation interactive, les vérifications de santé du service et
 * l'orientation des développeurs vers les ressources principales.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Contrôleur principal de l'application O'Ypunu
 * 
 * Point d'entrée central de l'API fournissant la page d'accueil interactive,
 * la documentation développeur et les endpoints de monitoring pour garantir
 * une excellente expérience d'intégration.
 * 
 * ## 🎯 Fonctionnalités principales :
 * 
 * ### 🏠 Page d'accueil interactive
 * - **Interface développeur** : Page HTML élégante avec design professionnel
 * - **Navigation intuitive** : Liens directs vers Swagger UI et documentation
 * - **Exemples pratiques** : Code samples pour authentification et usage
 * - **Endpoints référence** : Liste visuelle des endpoints principaux
 * 
 * ### 📋 Documentation intégrée
 * - **Guide de démarrage** : Instructions step-by-step pour l'intégration
 * - **Exemples d'authentification** : Patterns JWT et gestion des tokens
 * - **Ressources développeur** : Liens vers GitHub, support et documentation
 * 
 * ### 🔍 Monitoring et santé
 * - **Health check** : Endpoint de vérification de l'état du service
 * - **Métadonnées temps réel** : Timestamp et statut pour monitoring
 * - **Intégration CI/CD** : Support pour pipelines et déploiements
 * 
 * ## 🎨 Interface utilisateur :
 * - **Design moderne** : UI dark theme avec animations CSS
 * - **Responsive** : Adaptation mobile et desktop
 * - **Accessibilité** : Couleurs et contrastes optimisés
 * - **Performance** : CSS inline pour chargement instantané
 * 
 * @class AppController
 * @version 1.0.0
 */
@ApiTags('app')
@Controller()
export class AppController {
  /**
   * Constructeur du contrôleur principal
   * @param {AppService} appService - Service principal de l'application
   */
  constructor(private readonly appService: AppService) {}

  /**
   * Affiche la page d'accueil interactive de l'API O'Ypunu
   * 
   * Endpoint racine qui présente une interface développeur élégante avec
   * documentation intégrée, guide de démarrage, exemples de code et
   * navigation directe vers les ressources principales de l'API.
   * 
   * @method getApiInfo
   * @param {Response} res - Objet Response Express pour rendu HTML
   * @returns {void} Page HTML complète avec CSS intégré et navigation
   * 
   * @example
   * GET /
   * // Retourne: Page HTML interactive avec documentation développeur
   */
  @Get()
  @ApiOperation({ summary: "Page d'accueil de l'API" })
  @ApiResponse({
    status: 200,
    description:
      "Renvoie la page HTML d'accueil de l'API avec les informations générales",
  })
  getApiInfo(@Res() res: Response) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>O'Ypunu API</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #0f1420;
              color: #ffffff;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1, h2 { 
              color: #ffffff;
              font-weight: 600;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
            }
            h2 {
              font-size: 1.5rem;
              margin-top: 1.5rem;
            }
            .container {
              padding: 2rem 0;
            }
            .card { 
              background-color: #1a1f2e;
              border: 1px solid #2d3548;
              border-radius: 8px;
              padding: 1.5rem;
              margin-bottom: 1.5rem;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            }
            .btn { 
              display: inline-block;
              background: #8a2be2;
              color: white;
              padding: 0.75rem 1.25rem;
              font-weight: 500;
              text-decoration: none;
              border-radius: 6px;
              margin-right: 1rem;
              margin-top: 0.5rem;
              transition: all 0.2s ease;
            }
            .btn:hover {
              background: #9b4ddb;
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(138, 43, 226, 0.3);
            }
            code { 
              background: #2d3548;
              padding: 2px 7px;
              border-radius: 4px;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
              font-size: 0.9em;
            }
            a {
              color: #a87eff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            .text-gray { 
              color: #a0aec0;
            }
            .header {
              display: flex;
              align-items: center;
              margin-bottom: 2rem;
              border-bottom: 1px solid #2d3548;
              padding-bottom: 1rem;
            }
            .logo {
              font-size: 1.8rem;
              font-weight: bold;
              margin-right: 1rem;
            }
            .logo-highlight {
              color: #8a2be2;
            }
            footer {
              margin-top: 3rem;
              padding-top: 1.5rem;
              border-top: 1px solid #2d3548;
              color: #a0aec0;
              font-size: 0.9rem;
            }
            .endpoint {
              display: flex;
              margin-bottom: 0.75rem;
              align-items: center;
            }
            .endpoint-method {
              padding: 0.25rem 0.5rem;
              border-radius: 4px;
              font-size: 0.8rem;
              font-weight: bold;
              margin-right: 0.75rem;
              min-width: 50px;
              text-align: center;
            }
            .get {
              background-color: #2563eb;
              color: white;
            }
            .post {
              background-color: #16a34a;
              color: white;
            }
            .put {
              background-color: #ca8a04;
              color: white;
            }
            .delete {
              background-color: #dc2626;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo"><span class="logo-highlight">O'</span>Ypunu</div>
              <div>API du dictionnaire social multilingue</div>
            </div>

            <h1>Documentation API</h1>
            <p class="text-gray">Bienvenue sur l'API O'Ypunu, votre portail pour intégrer notre dictionnaire multilingue dans vos applications.</p>
            
            <div class="card">
              <h2>Documentation interactive</h2>
              <p>Explorez toutes les fonctionnalités de notre API avec la documentation interactive Swagger :</p>
              <a href="/api-docs" class="btn">Ouvrir Swagger UI</a>
            </div>
            
            <div class="card">
              <h2>Démarrage rapide</h2>
              <p>Pour commencer à utiliser l'API O'Ypunu, suivez ces étapes :</p>
              <ol>
                <li>Créez un compte utilisateur ou obtenez vos identifiants API</li>
                <li>Authentifiez-vous pour recevoir un token JWT</li>
                <li>Incluez ce token dans l'en-tête Authorization de vos requêtes</li>
                <li>Commencez à explorer le dictionnaire et ses fonctionnalités</li>
              </ol>
              <a href="/api-docs" class="btn">Voir les exemples</a>
            </div>
            
            <div class="card">
              <h2>Endpoints principaux</h2>
              
              <div class="endpoint">
                <span class="endpoint-method get">GET</span>
                <code>/api/words</code>
                <span class="text-gray" style="margin-left: 15px;">Liste des mots</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method get">GET</span>
                <code>/api/words/search</code>
                <span class="text-gray" style="margin-left: 15px;">Recherche de mots avec filtres</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method get">GET</span>
                <code>/api/words/{id}</code>
                <span class="text-gray" style="margin-left: 15px;">Détails d'un mot spécifique</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method get">GET</span>
                <code>/api/categories</code>
                <span class="text-gray" style="margin-left: 15px;">Liste des catégories</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method post">POST</span>
                <code>/api/words</code>
                <span class="text-gray" style="margin-left: 15px;">Ajouter un nouveau mot (authentifié)</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method post">POST</span>
                <code>/api/auth/login</code>
                <span class="text-gray" style="margin-left: 15px;">Authentification</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method post">POST</span>
                <code>/api/words/{id}/favorite</code>
                <span class="text-gray" style="margin-left: 15px;">Ajouter un mot aux favoris</span>
              </div>
              
              <div class="endpoint">
                <span class="endpoint-method delete">DELETE</span>
                <code>/api/words/{id}/favorite</code>
                <span class="text-gray" style="margin-left: 15px;">Retirer un mot des favoris</span>
              </div>
            </div>
            
            <div class="card">
              <h2>Exemple d'authentification</h2>
              <p>Obtenez un token JWT :</p>
              <pre><code>POST /api/auth/login
Content-Type: application/json

{
  "email": "votre-email@exemple.com",
  "password": "votre-mot-de-passe"
}</code></pre>

              <p>Utilisez le token dans vos requêtes :</p>
              <pre><code>GET /api/words/favorites/user
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code></pre>
            </div>
            
            <div class="card">
              <h2>Ressources</h2>
              <ul>
                <li><a href="/api/docs">Documentation complète (Swagger)</a></li>
                <li><a href="https://github.com/Chermann-KING/oypunu/tree/main/backend">Code source sur GitHub</a></li>
                <li><a href="mailto:contact@oypunu.com">Contacter l'équipe</a></li>
              </ul>
            </div>
          
            <footer>
              <p>&copy; ${new Date().getFullYear()} O'Ypunu. Tous droits réservés.</p>
              <p>Un dictionnaire social multilingue pour le monde moderne.</p>
            </footer>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * Endpoint de vérification de l'état de santé de l'API
   * 
   * Endpoint essentiel pour le monitoring, les health checks automatisés
   * et l'intégration dans les pipelines CI/CD. Fournit un statut temps réel
   * de la disponibilité du service.
   * 
   * @method healthCheck
   * @returns {Object} Statut de santé avec timestamp ISO
   * @returns {string} returns.status - Statut "ok" si service opérationnel
   * @returns {string} returns.timestamp - Timestamp ISO de la vérification
   * 
   * @example
   * GET /api/health
   * // Retourne: { "status": "ok", "timestamp": "2025-01-31T10:30:00.000Z" }
   */
  @Get('api/health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
