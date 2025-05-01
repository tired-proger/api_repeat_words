const express = require("express");
const db = require("./db.js");
const cors = require("cors");
const formatWord = require("./formatWord.js");

const app = express();

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const singleReturnSql = "select * from words offset floor(random() * (select count(*) from words)) limit 1;";
const manyReturnSql = "select * from words order by random() limit 3;";

async function getRandomWords(req, res) {

	const { mode } = req.query;
	
	if (!mode) return res.status(500).json({error: "Error request"});

	try {

		let words = null;

		if (mode === "single") words = await db.query(singleReturnSql);
		if (mode === "many") words = await db.query(manyReturnSql);

		let data = [];

		for (let row of words.rows) {

			let sentences = await db.query("select * from sentences where word_id = $1", [ row.id ]);
			data.push({ ...row, sentences: sentences.rows });

		}

		res.json(data);

	} catch(e) {
		console.log(e);
		res.status(500).json({error: "Error request"});
		return;
	}

}

async function addWord(req, res) {

	const data = req.body;

	if (!(data.word.trim().length >= 3)) return res.status(500).json({error: "Error request"});

	let description = data.description || null;

	try {

		const searchWord = formatWord(data.word);
		const searchedWord = await db.query("select * from words where word like $1", [ searchWord ]);

		if (searchedWord.rows.length) return res.status(500).json({error: "already have"});

		const newWord = await db.query("insert into words (word, description) values ($1, $2) returning *", [ searchWord, description ]);
		const ID = newWord.rows[0].id;

		if (data.sentences) {

			for (let sentence of data.sentences) {
				await db.query("insert into sentences (sentence, word_id) values ($1, $2)", [ sentence, ID ]);
			}

		}

		res.json({ status: true });

	} catch (e) {
		console.log(e);
		res.status(500).json({error: "Error request"});
		return;
	}

}

async function editDescription(req, res) {

	let { text, id } = req.body;

	text = text || null;

	try {

		await db.query("update words set description = $1 where id = $2", [ text, id ]);
		res.json({ status: true });

	} catch(e) {
		console.log(e);
		res.status(500).json({ error: "Error request" });
		return;
	}

}

async function addSentenceWord(req, res) {

	const { text, id } = req.body;

	if (!(text.trim().length >= 3)) return res.status(500).json({error: "Error request"});

	try {

		let newRow = await db.query("insert into sentences (sentence, word_id) values ($1, $2) returning *", [ text, id ]);
		res.json({ status: true, id: newRow.rows[0].id });

	} catch(e) {
		console.log(e);
		res.status(500).json({ error: "Error request" });
		return;
	}

}

async function deleteSentenceWord(req, res) {

	const { id } = req.body;

	try {

		await db.query("delete from sentences where id = $1", [ id ]);
		res.json({ status: true });

	} catch(e) {
		console.log(e);
		res.status(500).json({ error: "Error request" });
		return;
	}

}

async function editSentenceWord(req, res) {

	const { text, id } = req.body;

	if (!(text.trim().length >= 3)) return res.status(500).json({error: "Error request"});

	try {

		await db.query("update sentences set sentence = $1 where id = $2", [ text, id ]);
		res.json({ status: true });

	} catch(e) {
		console.log(e);
		res.status(500).json({ error: "Error request" });
		return;
	}

}

const privateRoutesMiddleware = (req, res, next) => {
	let credentials = req.headers.Authorization;
	//Basic creds
	if (credentials) {
		credentials = credentials.split(" ")[1];
		if (credentials) {
			//{login:dhwaudhuia, pass:dnadowad}
			try {
				const creadentialsData = JSON.parse(credentials);
				if (
					creadentialsData.login === CREDENTIALS_LOGIN && 
					creadentialsData.pass === CREDENTIALS_PASS
				) return next();
			} catch(e) {
				return res.status(401).send({ error: "access forbidden" });
			}
		}
	}
	return res.status(401).send({ error: "access forbidden" });
}

//routes
app.get("/api/words", getRandomWords);
app.post("/api/words/add", privateRoutesMiddleware, addWord);
app.post("/api/words/description", privateRoutesMiddleware, editDescription);
app.post("/api/words/sentences/add", privateRoutesMiddleware, addSentenceWord);
app.post("/api/words/sentences/delete", privateRoutesMiddleware, deleteSentenceWord);
app.post("/api/words/sentences/edit", privateRoutesMiddleware, editSentenceWord);

app.listen(PORT, () => console.log("Server has been started"));

module.exports = app;