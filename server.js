const app = express();
const port = 3000;

// Middleware per il parsing del corpo della richiesta
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurazione del database
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'interrogazioni_orizzontali'
}); 

// Connessione al database
db.connect((err) => {
  if (err) {
    console.error('Errore durante la connessione al database:', err);
    return;
  }
  console.log('Connessione al database avvenuta con successo!');
});


function registrazioneDocente(nome, cognome, email, password, callback) {
  const query = `INSERT INTO professore (Nome, Cognome, Mail, Password) VALUES (?, ?, ?, ?)`;
  db.query(query, [nome, cognome, email, password], (err, result) => {
      if (err) {
          callback(err, null);
      } else {
          // Se l'inserimento ha avuto successo, ritorna l'ID del nuovo docente
          callback(null, result.insertId);
      }
  });
}

// Funzione per autenticare il docente
function autenticazioneDocente(username, password, callback) {
  const query = `SELECT * FROM professore WHERE Mail = ? AND Password = ?`;
  db.query(query, [username, password], (err, result) => {
      if (err) {
          callback(err, null);
      } else {
          if (result.length > 0) {
              callback(null, true);
          } else {
              callback(null, false);
          }
      }
  });
}
// Funzione per ottenere una domanda casuale dal database
function getDomandaCasuale(callback) {
  const query = `SELECT * FROM domanda ORDER BY RAND() LIMIT 1`;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Errore durante il recupero della domanda casuale:', err);
      callback(err, null);
    } else {
      const domandaCasuale = result[0];
      callback(null, domandaCasuale);
    }
  });
}

// Funzione per ottenere la domanda successiva
function domandaSuccessiva(idInterrogazione, callback) {
  const query = `SELECT * FROM domanda WHERE ID_domanda NOT IN (SELECT ID_domanda FROM interrogazione_domanda WHERE ID_interrogazione = ?) ORDER BY RAND() LIMIT 1`;
  db.query(query, [idInterrogazione], (err, result) => {
    if (err) {
      console.error('Errore durante il recupero della domanda successiva:', err);
      callback(err, null);
    } else {
      const domandaSuccessiva = result[0];
      callback(null, domandaSuccessiva);
    }
  });
}

// Funzione per avviare un'interrogazione nel database
function avviaInterrogazione(durataGiorni, dataInizio, callback) {
  const queryInterrogazione = `INSERT INTO interrogazione (Durata_Giorni, Data_Inizio) VALUES (?, ?)`;
  db.query(queryInterrogazione, [durataGiorni, dataInizio], (err, result) => {
    if (err) {
      callback(err, null);
    } else {
      const interrogazioneId = result.insertId;
      callback(null, interrogazioneId);
    }
  });
}

// Funzione per salvare il voto dello studente e ottenere una nuova domanda e un nuovo studente
function studenteSuccessivo(idInterrogazione, idStudente, voto, callback) {
  // Salva il voto dello studente nella tabella interrogazione_studente
  const query = `INSERT INTO interrogazione_studente (Voto_temporaneo, ID_interrogazione, ID_studente) VALUES (?, ?, ?)`;
  db.query(query, [voto, idInterrogazione, idStudente], (err, result) => {
    if (err) {
      callback(err, null, null);
    } else {
      // Ottenere la domanda successiva
      domandaSuccessiva(idInterrogazione, (err, nuovaDomanda) => {
        if (err) {
          callback(err, null, null);
        } else {
          // Ottenere un nuovo studente
          getStudenteCasuale((err, nuovoStudente) => {
            if (err) {
              callback(err, null, null);
            } else {
              callback(null, nuovaDomanda, nuovoStudente);
            }
          });
        }
      });
    }
  });
}

// Endpoint per il login del docente
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  autenticazioneDocente(username, password, (err, successo) => {
    if (err) {
      console.error('Errore durante l\'autenticazione:', err);
      res.status(500).send('Errore durante l\'autenticazione');
    } else {
      if (successo) {
        res.status(200).send('Login avvenuto con successo');
        //porta alla pagina2
        res.sendFile(path.join(__dirname, 'Pagina2.html'));
      } else {
        res.status(401).send('Credenziali non valide');
      }
    }
  });
});

// Endpoint per avviare un'interrogazione
app.post('/avviaInterrogazione', (req, res) => {
  const { durataGiorni, dataInizio } = req.body;
  avviaInterrogazione(durataGiorni, dataInizio, (err, interrogazioneId) => {
    if (err) {
      console.error('Errore durante l\'avvio dell\'interrogazione:', err);
      res.status(500).send('Errore durante l\'avvio dell\'interrogazione');
    } else {
      res.status(200).json({ message: `Interrogazione ${interrogazioneId} avviata con successo`, interrogazioneId });
    }
  });
});

// Endpoint per salvare il voto dello studente e ottenere una nuova domanda e un nuovo studente
app.post('/studenteSuccessivo', (req, res) => {
  const { idInterrogazione, idStudente, voto } = req.body;
  studenteSuccessivo(idInterrogazione, idStudente, voto, (err, nuovaDomanda, nuovoStudente) => {
    if (err) {
      console.error('Errore durante il recupero della nuova domanda e dello studente:', err);
      res.status(500).send('Errore durante il recupero della nuova domanda e dello studente');
    } else {
      res.status(200).json({ nuovaDomanda, nuovoStudente });
    }
  });
});

// Servire i file statici dalla directory 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Funzione per ottenere una domanda casuale dal database
function getDomandaCasuale(callback) {
  const query = `SELECT * FROM domanda ORDER BY RAND() LIMIT 1`;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Errore durante il recupero della domanda casuale:', err);
      callback(err, null);
    } else {
      const domandaCasuale = result[0];
      callback(null, domandaCasuale);
    }
  });
}

// Aggiunta di una nuova domanda
app.post('/domande', (req, res) => {
  const { testo, materia, macroargomento, tag } = req.body;
  const query = `INSERT INTO domanda (Testo, Materia, Macroargomento, Tag) VALUES (?, ?, ?, ?)`;
  db.query(query, [testo, materia, macroargomento, tag], (err, result) => {
    if (err) {
      console.error('Errore durante l\'aggiunta della nuova domanda:', err);
      res.status(500).send('Errore durante l\'aggiunta della nuova domanda');
    } else {
      res.status(200).send('Nuova domanda aggiunta con successo');
    }
  });
});


app.get('/', (req, res) => {
  // Serve la pagina di login 
  res.sendFile(path.join(__dirname, 'Pagina_di_login.html'));
});

// Avvio del server
app.listen(port, () => {
  console.log(`Server avviato su http://localhost:${port}`);
});