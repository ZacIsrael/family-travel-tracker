import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

// allows us to access our passwords and other sensitive variables from the .env file
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.PG_USERNAME,
  host: "localhost",
  // access the "world" database in postgreSQL
  database: "world",
  password: process.env.PG_PASSWORD,
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// name of the table in the postgreSQL database that stores the codes of the visited countries
const visitedCountriesTable = "visited_countries";

// name of the table in the postgreSQL database that stores all the countries & their respective codes
const countries = "countries";

// name of the table in the postgreSQL database that stores the users
const usersTable = "users";


let currentUserId = 1;

let users = [
  // { id: 1, name: "Angela", color: "teal" },
  // { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}
app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  try {
    const allUsers = await db.query(`SELECT * FROM ${usersTable}`);
    console.log('allUsers.rows = ', allUsers.rows);
    users = allUsers.rows;
  } catch(err){
    // an error occured
    console.error("Default GET Route; Error executing query: ", err.stack);
  }

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: "teal",
  });
});
app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code) VALUES ($1)",
        [countryCode]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

// adds a user
app.post("/user", async (req, res) => {
  console.log('req.body = ', req.body);

});

// render new.ejs
app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html


});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
