# Diagrammes de Flux Complets - O'Ypunu Backend

## 🌊 Vue d'Ensemble des Flows

Cette documentation présente les diagrammes de flux complets pour tous les parcours utilisateur critiques de la plateforme O'Ypunu, de l'inscription à l'utilisation avancée.

## 🚀 1. Parcours d'Onboarding Complet

### Flow d'Inscription et Activation
```mermaid
flowchart TD
    A[Visiteur arrive sur plateforme] --> B{Utilisateur existant?}
    B -->|Non| C[Page d'inscription]
    B -->|Oui| D[Page de connexion]
    
    C --> E[Saisie informations]
    E --> F{Validation données?}
    F -->|Erreur| G[Affichage erreurs]
    G --> E
    F -->|Valide| H[Création compte]
    
    H --> I[Envoi email vérification]
    I --> J[Page confirmation envoi]
    J --> K[Utilisateur clique lien email]
    K --> L[Vérification token]
    L --> M{Token valide?}
    
    M -->|Non| N[Erreur token expiré]
    M -->|Oui| O[Activation compte]
    O --> P[Première connexion]
    
    D --> Q[Saisie credentials]
    Q --> R{Authentification?}
    R -->|Erreur| S[Message erreur]
    S --> Q
    R -->|Succès| T{Email vérifié?}
    T -->|Non| U[Rappel vérification]
    T -->|Oui| V[Connexion réussie]
    
    P --> W[Configuration initiale]
    V --> W
    U --> W
    W --> X[Sélection langue native]
    X --> Y[Choix langues d'apprentissage]
    Y --> Z[Configuration préférences]
    Z --> AA[Découverte interface]
    AA --> BB[Premier mot créé/recherché]
    BB --> CC[Onboarding terminé]
```

## 📚 2. Cycle de Vie d'un Mot dans le Dictionnaire

### Flow Création → Publication → Engagement
```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant WC as WordsController
    participant WS as WordsService
    participant VS as ValidationService
    participant WR as WordRepository
    participant AS as ActivityService
    participant NS as NotificationService
    participant CS as CommunityService

    U->>+WC: POST /words (créer mot)
    WC->>+WS: create(wordData, user)
    WS->>+VS: validateWordData()
    VS-->>-WS: validation result
    
    alt Validation échoue
        WS-->>WC: BadRequestException
        WC-->>U: 400 + erreurs validation
    else Validation réussie
        WS->>+WR: checkDuplicate()
        WR-->>-WS: not duplicate
        
        WS->>+WR: save(word)
        WR-->>-WS: saved word
        
        WS->>+AS: logWordCreated()
        AS-->>-WS: activity logged
        
        WS->>+NS: notifyModerators(if pending)
        NS-->>-WS: notifications sent
        
        WS-->>-WC: created word
        WC-->>-U: 201 + word data
    end
    
    Note over U,CS: Modération (si statut = pending)
    
    U->>+WC: GET /admin/words/pending
    WC->>+WS: getPendingWords()
    WS-->>-WC: pending words
    WC-->>-U: liste mots en attente
    
    U->>+WC: PUT /words/:id/status (approve)
    WC->>+WS: updateStatus(id, 'approved')
    WS->>+WR: updateStatus()
    WR-->>-WS: updated word
    WS->>+AS: logWordApproved()
    WS->>+NS: notifyWordCreator()
    WS-->>-WC: approved word
    WC-->>-U: 200 + updated word
    
    Note over U,CS: Engagement communautaire
    
    U->>+WC: POST /words/:id/favorites
    WC->>+WS: addToFavorites()
    WS-->>-WC: favorite added
    WC-->>-U: 200 + success
    
    U->>+CS: POST /communities/:id/posts (partage mot)
    CS->>CS: createPost(with word reference)
    CS-->>U: post created
```

## 🌍 3. Dynamiques de Communauté

### Flow Création Communauté → Croissance → Modération
```mermaid
stateDiagram-v2
    [*] --> CommunityCreated: Utilisateur crée communauté
    
    CommunityCreated --> GrowthPhase: Membres rejoignent
    
    state GrowthPhase {
        [*] --> SmallCommunity: < 10 membres
        SmallCommunity --> MediumCommunity: 10-100 membres
        MediumCommunity --> LargeCommunity: 100+ membres
        
        SmallCommunity: Auto-modération légère
        MediumCommunity: Modération active requise
        LargeCommunity: Équipe modération + outils auto
    }
    
    GrowthPhase --> ActiveCommunity: Engagement régulier
    
    state ActiveCommunity {
        [*] --> HealthyCommunity
        HealthyCommunity --> ToxicCommunity: Signalements multiples
        ToxicCommunity --> HealthyCommunity: Modération effective
        ToxicCommunity --> QuarantinedCommunity: Échec modération
        QuarantinedCommunity --> HealthyCommunity: Réhabilitation
        QuarantinedCommunity --> ArchivedCommunity: Fermeture définitive
        
        HealthyCommunity: Posts réguliers, engagement positif
        ToxicCommunity: Contenus problématiques, conflits
        QuarantinedCommunity: Accès restreint, surveillance
    }
    
    ActiveCommunity --> InactiveCommunity: Baisse d'activité
    InactiveCommunity --> ActiveCommunity: Relance réussie
    InactiveCommunity --> ArchivedCommunity: Abandon définitif
    
    ArchivedCommunity --> [*]
```

## 💬 4. Messagerie Temps Réel

### Flow Communication Instantanée
```mermaid
sequenceDiagram
    participant UA as User A
    participant WS as WebSocket Gateway
    participant MS as MessagingService
    participant MR as MessageRepository
    participant UB as User B
    participant NS as NotificationService
    participant PS as PushService

    UA->>+WS: connect()
    WS->>WS: authenticate user
    WS->>+MS: registerUserOnline(userA)
    MS-->>-WS: user registered
    WS-->>-UA: connected

    UB->>+WS: connect()
    WS->>+MS: registerUserOnline(userB)
    MS-->>-WS: user registered
    WS-->>-UB: connected
    WS->>UA: user_online(userB)

    UA->>+WS: typing_start(conversationId)
    WS->>UB: typing_start(userA)
    WS-->>-UA: typing_acknowledged

    UA->>+WS: send_message(content, conversationId)
    WS->>+MS: processMessage()
    MS->>+MR: saveMessage()
    MR-->>-MS: message saved
    MS->>+NS: createNotification(userB)
    NS-->>-MS: notification created
    MS-->>-WS: message processed

    WS->>UB: new_message(message)
    WS->>+PS: sendPushIfOffline(userB)
    PS-->>-WS: push handled
    WS-->>-UA: message_sent(messageId)

    UB->>+WS: message_read(messageId)
    WS->>+MS: markMessageRead()
    MS->>+MR: updateReadStatus()
    MR-->>-MS: status updated
    MS-->>-WS: read status updated
    WS->>UA: message_read(messageId, userB)
    WS-->>-UB: read_acknowledged

    Note over UA,PS: Déconnexion gracieuse
    UA->>+WS: disconnect()
    WS->>+MS: registerUserOffline(userA)
    MS-->>-WS: user offline
    WS->>UB: user_offline(userA)
    WS-->>-UA: disconnected
```

## 📊 5. Analytics et Collecte de Données

### Flow Événement → Agrégation → Insights
```mermaid
flowchart TD
    A[Événement Application] --> B[Event Collector]
    B --> C{Type d'événement?}
    
    C -->|User Action| D[User Analytics Buffer]
    C -->|System Metric| E[Performance Buffer]
    C -->|Business Event| F[Content Analytics Buffer]
    
    D --> G[Validation & Enrichment]
    E --> G
    F --> G
    
    G --> H[Raw Events Storage]
    H --> I{Real-time requis?}
    
    I -->|Oui| J[Real-time Aggregator]
    I -->|Non| K[Batch Queue]
    
    J --> L[Live Dashboard Update]
    J --> M[Threshold Checking]
    
    K --> N[Scheduled Aggregation]
    N --> O[Hourly Aggregates]
    O --> P[Daily Aggregates]
    P --> Q[Weekly/Monthly Aggregates]
    
    M --> R{Seuil dépassé?}
    R -->|Oui| S[Alert Generation]
    R -->|Non| T[Continue Monitoring]
    
    S --> U[Notification Admin]
    
    Q --> V[Report Generation]
    V --> W[Insights & Recommendations]
    
    L --> X[WebSocket Broadcast]
    X --> Y[Admin Dashboard]
    
    W --> Z[Automated Actions]
    Z --> AA[Performance Optimization]
    Z --> BB[Content Recommendations]
    Z --> CC[User Experience Improvements]
```

## 🔄 6. Système de Permissions Cross-Module

### Flow Vérification Permissions Complexes
```mermaid
flowchart TD
    A[Requête utilisateur] --> B[Authentication Guard]
    B --> C{Utilisateur authentifié?}
    C -->|Non| D[401 Unauthorized]
    C -->|Oui| E[Extraction contexte]
    
    E --> F[Permission Service]
    F --> G{Type de ressource?}
    
    G -->|Word| H[Word Permission Check]
    G -->|Community| I[Community Permission Check]
    G -->|Message| J[Message Permission Check]
    G -->|Admin| K[Admin Permission Check]
    
    H --> L{Propriétaire du mot?}
    L -->|Oui| M[Autorisé]
    L -->|Non| N{Rôle ≥ Moderator?}
    N -->|Oui| O{Action autorisée pour rôle?}
    N -->|Non| P[403 Forbidden]
    O -->|Oui| M
    O -->|Non| P
    
    I --> Q{Membre de la communauté?}
    Q -->|Non| R[403 Forbidden]
    Q -->|Oui| S{Rôle dans communauté?}
    S --> T{Action autorisée?}
    T -->|Oui| M
    T -->|Non| P
    
    J --> U{Participant conversation?}
    U -->|Non| P
    U -->|Oui| V{Message lui appartient?}
    V -->|Oui| M
    V -->|Non| W{Peut voir conversation?}
    W -->|Oui| X{Action lecture seule?}
    X -->|Oui| M
    X -->|Non| P
    W -->|Non| P
    
    K --> Y{Rôle ≥ Admin?}
    Y -->|Non| P
    Y -->|Oui| Z{Scope d'administration?}
    Z --> AA{Dans son périmètre?}
    AA -->|Oui| M
    AA -->|Non| P
    
    M --> BB[Exécution action]
    P --> CC[Log tentative non autorisée]
    D --> DD[Redirection connexion]
    R --> EE[Message erreur contextualisé]
```

## 🔐 7. Flow de Sécurité et Audit

### Audit Trail et Détection Anomalies
```mermaid
sequenceDiagram
    participant U as User
    participant App as Application
    participant AS as Audit Service
    participant AD as Anomaly Detector
    participant SM as Security Monitor
    participant Admin as Admin
    participant Alert as Alert System

    U->>+App: Action utilisateur
    App->>+AS: logSecurityEvent()
    AS->>AS: enrichEvent(context, metadata)
    AS->>AS: storeAuditLog()
    AS-->>-App: audit logged
    App-->>-U: response

    AS->>+AD: analyzeEvent()
    AD->>AD: compareWithBaseline()
    AD->>AD: calculateRiskScore()
    
    alt Score risque élevé
        AD->>+SM: flagSuspiciousActivity()
        SM->>SM: correlateWithOtherEvents()
        SM->>SM: assessThreatLevel()
        
        alt Menace confirmée
            SM->>+Alert: triggerSecurityAlert()
            Alert->>Admin: notifyImmediate()
            Alert->>+App: temporaryAccountRestriction()
            App-->>-Alert: restrictions applied
            Alert-->>-SM: alert sent
            SM-->>-AD: threat handled
        else Faux positif
            SM->>SM: updateBaselineModel()
            SM-->>-AD: continue monitoring
        end
    else Score normal
        AD->>AD: updateUserBaseline()
    end
    
    AD-->>-AS: analysis complete

    Note over AS,Admin: Rapport audit périodique
    AS->>AS: generateAuditReport()
    AS->>Admin: weeklySecurityReport()
```

## 📈 8. Scalabilité et Performance

### Flow Optimisation Automatique
```mermaid
flowchart TD
    A[Monitoring Performance] --> B{Métriques collectées}
    B --> C[Response Time Analysis]
    B --> D[Resource Usage Analysis]
    B --> E[Error Rate Analysis]
    
    C --> F{Response time > seuil?}
    D --> G{CPU/Memory > seuil?}
    E --> H{Error rate > seuil?}
    
    F -->|Oui| I[Database Query Optimization]
    G -->|Oui| J[Resource Scaling Decision]
    H -->|Oui| K[Error Source Investigation]
    
    I --> L[Index Analysis]
    I --> M[Query Plan Review]
    I --> N[Cache Strategy Update]
    
    J --> O[Horizontal Scaling]
    J --> P[Vertical Scaling]
    J --> Q[Load Balancer Adjustment]
    
    K --> R[Log Analysis]
    K --> S[Exception Tracking]
    K --> T[Dependency Check]
    
    L --> U[Create/Update Indexes]
    M --> V[Query Rewriting]
    N --> W[Cache Warming]
    
    O --> X[Spawn New Instances]
    P --> Y[Increase Instance Resources]
    Q --> Z[Update Routing Rules]
    
    R --> AA[Identify Error Patterns]
    S --> BB[Fix Critical Bugs]
    T --> CC[Service Health Check]
    
    U --> DD[Performance Validation]
    V --> DD
    W --> DD
    X --> EE[Load Distribution]
    Y --> EE
    Z --> EE
    AA --> FF[Error Mitigation]
    BB --> FF
    CC --> FF
    
    DD --> GG{Performance améliorée?}
    EE --> HH{Charge distribuée?}
    FF --> II{Erreurs réduites?}
    
    GG -->|Non| JJ[Escalade vers équipe]
    HH -->|Non| JJ
    II -->|Non| JJ
    
    GG -->|Oui| KK[Continue Monitoring]
    HH -->|Oui| KK
    II -->|Oui| KK
    
    JJ --> LL[Manual Intervention]
    KK --> A
```

## 🎯 Points Clés d'Optimisation

### 1. **Goulots d'Étranglement Identifiés**
- **Database Queries**: Index manquants sur recherches complexes
- **WebSocket Connections**: Limite concurrent connections
- **File Uploads**: Traitement synchrone des gros fichiers
- **Analytics Processing**: Batch processing bloque real-time

### 2. **Solutions Implémentées**
- **Connection Pooling**: Pool optimisé par type de requête
- **Caching Strategy**: Redis pour données fréquemment accédées
- **Async Processing**: Queue system pour tâches lourdes
- **CDN Integration**: Assets statiques distribués globalement

### 3. **Métriques de Performance Cibles**
- **API Response Time**: < 200ms (95th percentile)
- **Database Queries**: < 50ms (moyenne)
- **WebSocket Latency**: < 100ms
- **File Upload**: < 5s (10MB file)
- **Search Results**: < 300ms
- **Page Load Time**: < 2s (initial load)

---

**Version**: 1.0.0  
**Dernière mise à jour**: 30 Juillet 2025  
**Responsable**: Équipe Architecture O'Ypunu