# 🚒 Ortswehr PWA

Progressive Web App für die Ortswehr-Verwaltung.
**Stack:** Vanilla JS · Firebase Firestore · Firebase Auth · GitHub Pages

---

## Deployment (GitHub Pages – kostenlos)

### 1. Repository anlegen
1. github.com → "New repository" → Name: `ortswehr` → Public → Create
2. Diese Dateien hochladen (Upload files oder git push)

### 2. GitHub Pages aktivieren
1. Repository → Settings → Pages
2. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
3. Save → nach 1-2 Minuten läuft die App unter:
   `https://DEIN-USERNAME.github.io/ortswehr/`

### 3. Firebase Domain freischalten
1. Firebase Console → Authentication → Sign-in method → Authorized domains
2. `DEIN-USERNAME.github.io` hinzufügen

### 4. Firestore Regeln setzen
Firebase Console → Firestore → Rules → ersetzen mit:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Benutzer: nur eigenes Profil lesen/schreiben; Wehrführer alles
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rolle == 'wehrfuehrer';

      // Qualifikationen
      match /qualifikationen/{id} {
        allow read: if request.auth.uid == userId
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rolle == 'wehrfuehrer';
        allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rolle == 'wehrfuehrer';
      }
    }

    // Übungen: alle lesen, nur Wehrführer schreiben
    match /uebungen/{id} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rolle == 'wehrfuehrer';
    }

    // Anwesenheiten: eigene anlegen (vorschlagen), Wehrführer alles
    match /anwesenheiten/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rolle == 'wehrfuehrer';
    }
  }
}
```

---

## Ersten Admin anlegen

Da du der erste User bist:
1. App öffnen → mit deiner E-Mail registrieren lassen
   (beim ersten Login wird automatisch ein Profil mit Rolle `kamerad` angelegt)
2. Firebase Console → Firestore → Collection `users` → dein Dokument öffnen
3. Feld `rolle` auf `wehrfuehrer` setzen
4. App neu laden → du hast Wehrführer-Rechte

---

## App auf Android installieren

1. App-URL in Chrome öffnen
2. Drei-Punkte-Menü → **"Zum Startbildschirm hinzufügen"**
3. Fertig – die App verhält sich wie eine native App!

## Icons erstellen (optional)
Erstelle `icons/icon-192.png` (192×192px) und `icons/icon-512.png` (512×512px)
mit einem Feuerwehr-Logo deiner Wahl.
Ohne Icons funktioniert die App, aber das Installieren sieht besser aus.

---

## Struktur
```
ortswehr/
├── index.html       # App-Shell, Firebase-Init, Router
├── manifest.json    # PWA-Manifest
├── sw.js            # Service Worker (Offline)
├── css/
│   └── style.css    # Alle Styles
├── js/
│   └── pages.js     # Alle Seiten/Views
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Erweiterungsideen
- Push-Benachrichtigungen bei neuen Übungen
- PDF-Export der Anwesenheitsliste
- Kalenderansicht
- Einsatzprotokoll
- Fahrzeugverwaltung
