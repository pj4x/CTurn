# TCP-Chat-Server Dokumentation

## Übersicht
Ein Node.js TCP-Server für Chat-Räume mit folgenden Funktionen:
- Benutzerauthentifizierung mit eindeutigen Usernamen
- Raumverwaltung (Erstellen/Beitreten/Verlassen)
- Nachrichtenverteilung in Räumen
- Systemnachrichten für Benutzeraktivitäten
- Fehlerbehandlung mit detaillierten Meldungen

## Nachrichtenformat
Alle Nachrichten werden als JSON-Objekte übertragen.

## End-to-End-Verschlüsselung

### Architekturänderungen
1. **Hybride Verschlüsselung**
   - RSA-2048 für Schlüsselaustausch
   - AES-256-GCM für Nachrichtenverschlüsselung
2. **Schlüsselverwaltung**
   - Jeder Client generiert ein RSA-Schlüsselpaar beim Start
   - Public Keys werden über den Server ausgetauscht


### Client → Server
| Typ        | Pflichtfeld | Beschreibung                       | Beispiel                                      |
|------------|-------------|------------------------------------|-----------------------------------------------|
| username   | content     | Benutzername festlegen             | `{"type":"username","body":{"content":"Bob"}}`|
| create     | content     | Raum erstellen                     | `{"type":"create","body":{"content":"lobby"}}`|
| join       | content     | Raum beitreten                     | `{"type":"join","body":{"content":"lobby"}}`  |
| message    | content     | Nachricht an Raum senden            | `{"type":"message","body":{"content":"Hallo"}}`|
| leave      | -           | Raum verlassen                     | `{"type":"leave","body":{"content":""}}`      |

### Server → Client
| Typ       | Felder         | Beschreibung                       | Beispiel                                      |
|-----------|----------------|------------------------------------|-----------------------------------------------|
| welcome   | content        | Bestätigung einer Aktion           | `{"type":"welcome","body":{"content":"Raum verlassen: lobby"}}` |
| error     | content        | Fehlermeldung                      | `{"type":"error","body":{"content":"Ungültiges Nachrichtenformat"}}` |
| message   | sender, content| Chatnachricht von Benutzer         | `{"type":"message","sender":"Bob","body":{"content":"Hallo"}}` |
| system    | content        | Systembenachrichtigung             | `{"type":"system","body":{"content":"Alice hat den Raum betreten"}}` |

## Befehlsreferenz
| Befehl          | Syntax            | Beschreibung                       |
|-----------------|-------------------|------------------------------------|
| Benutzername    | `/username <name>`| Muss als erstes gesendet werden    |
| Raum erstellen  | `/create <name>`  | Erstellt neuen Raum                |
| Raum beitreten  | `/join <name>`    | Tritt existierendem Raum bei       |
| Nachricht       | `<text>`          | Sendet Nachricht an aktuellen Raum |
| Raum verlassen  | `/leave`          | Verlässt aktuellen Raum            |

## Client-Verhalten
1. Verbindung herstellen
2. Raum mit `/create` oder `/join` betreten
3. Nachrichten senden oder Raum mit `/leave` verlassen

## Fehlerbehandlung
| Fehlermeldung                      | Ursache                                       |
|------------------------------------|-----------------------------------------------|
| "Ungültiges JSON-Format"           | Ungültige JSON-Syntax                         |
| "Ungültiges Nachrichtenformat"     | Fehlende Pflichtfelder in der Nachricht       |
| "Sie müssen einen Benutzernamen festlegen" | Aktion vor Benutzernamensetzung versucht      |
| "Raum existiert bereits"           | Versuch einen existierenden Raum zu erstellen |
| "Raum existiert nicht"             | Beitrittsversuch zu nicht-existentem Raum     |

## Beispielablauf
```json
// Client 1
> /username Alice
{"type":"welcome","body":{"content":"Benutzername gesetzt: Alice"}}
> /create lobby
{"type":"welcome","body":{"content":"Raum erstellt und betreten: lobby"}}
{"type":"system","body":{"content":"Alice hat den Raum erstellt"}}

// Client 2
> /username Bob
{"type":"welcome","body":{"content":"Benutzername gesetzt: Bob"}}
> /join lobby
{"type":"welcome","body":{"content":"Raum betreten: lobby"}}
{"type":"system","body":{"content":"Bob hat den Raum betreten"}}

// Client 1
> Hallo zusammen!
{"type":"message","sender":"Alice","body":{"content":"Hallo zusammen!"}}

// Client 2
> /leave
{"type":"system","body":{"content":"Bob hat den Raum verlassen"}}
{"type":"welcome","body":{"content":"Raum verlassen: lobby"}}
