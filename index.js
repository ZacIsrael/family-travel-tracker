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

// let currentUserId = 1;

// variable that will be used to store the users returned from queries
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

async function getAllUsers () {
  let allUsers = [];
  try {
  let result = await db.query(`SELECT * FROM ${usersTable}`);
  allUsers = result.rows;
  } catch(err){
    console.error(`getAllUsers(): error retrieving all of the users`);
  }
  return allUsers;
}
app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  try {
    // retrieve the users from the users table in the postgreSQL database
    const allUsers = await db.query(`SELECT * FROM ${usersTable}`);
    console.log("allUsers.rows = ", allUsers.rows);
    // assign the users variable to the rows that were returned from the query
    users = allUsers.rows;
  } catch (err) {
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

// displays the selected user's respective map
app.post("/user", async (req, res) => {
  console.log("req.body = ", req.body);
  // retrieve the id of the user from the request
  let userId = req.body.user;

  // variable that stores the result from the query
  let neededUser;

  try {
    // get the user with id = userId
    neededUser = await db.query(`SELECT * FROM ${usersTable} WHERE id = ($1)`, [
      userId,
    ]);
    console.log("neededUser = ", neededUser);

    // variable that stores the user and will be sent to the ejs file
    // users = neededUser.rows;

    // variable that stores the users and will be sent to the ejs file
    users = await getAllUsers();
  } catch (err) {
    // an error occured
    console.error(`\'/user\' POST Route; Error executing query that retrives the user with id = ${userId}: `, err.stack);
  }

  // if we reach this point, needUser is not undefined
  if (neededUser.rowCount !== 1) {
    // error; problem with database because more than 1 user has the same id
    console.error(
      `Database Error: The ${usersTable} table contains more than 1 user with id = ${userId}`
    );
  } else {
    // found the user with id = userId
    let retrievedUser = neededUser.rows[0];
    console.log("retrievedUser = ", retrievedUser);

    // retrieve that user's visited countries

    // variable that stores the result from the query
    let visitedCountriesByUserQuery;

    try {
      // retrieve the countries that this user has visited
      visitedCountriesByUserQuery = await db.query(
        `SELECT * FROM ${visitedCountriesTable} WHERE user_id = ($1)`,
        [userId]
      );
      console.log("visitedCountriesByUser = ", visitedCountriesByUserQuery);
    } catch (err) {
      // an error occured
      console.error(`\'/user\' POST Route; Error executing query that retrieves the countries for user with id = ${userId}: `, err.stack);
    }

    // the rows returned from the request
    let visitedCountriesByUser = visitedCountriesByUserQuery.rows;

    // clean up the data so that only the country codes will be sent to the EJS file (and not the id generated from postgreSQL)
    let visitedCountries = [];
    visitedCountriesByUser.forEach((val) => {
      visitedCountries.push(val.country_code);
    });

    // send the necessary data to the index ejs file
    res.render("index.ejs", {
      countries: visitedCountries,
      total: visitedCountries.length,
      users: users,
      color: retrievedUser.color,
    });


  }
});

// adds a new render new.ejs
app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
