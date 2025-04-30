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

// used to store the user's id; useful for when we wannt to add a country for a specific user
// we must do it this way because of how the EJS files have been implemented
let currentUserId = -1;

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

async function getAllUsers() {
  let allUsers = [];
  try {
    let result = await db.query(`SELECT * FROM ${usersTable}`);
    allUsers = result.rows;
  } catch (err) {
    console.error(`getAllUsers(): error retrieving all of the users`);
  }
  return allUsers;
}

// default get Route
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
    // color: color,
  });
});
app.post("/add", async (req, res) => {
  if (currentUserId === -1) {
    // must select a user before trying to add a country
    console.error(
      `Error in \'/add\' route: You can't add a country withput selecting a user first. Please select a user`
    );
    // return to the default get route
    res.redirect("/");
  } else {
    const input = req.body["country"];
    console.log(`\'/add\' route: req.body = `, req.body);

    if (input.trim().length === 0) {
      // user put space(s) as the country to be added
      console.error(
        `POST \'/add\' route: Please enter a country before clicking the \'add\' button.`
      );
      
    } else {
      try {
        const result = await db.query(
          "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
          [input.toLowerCase()]
        );

        const data = result.rows[0];
        const countryCode = data.country_code;
        try {
          await db.query(
            "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
            [countryCode, currentUserId]
          );
          // go back to the home page
          res.redirect("/");
        } catch (err) {
          console.log(err);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }
});

// displays the selected user's respective map
app.post("/user", async (req, res) => {
  console.log("req.body = ", req.body);

  if (req.body.hasOwnProperty("add")) {
    // If the the body of the request contains the field "add", that means that the
    // user clicked the "Add Family Member" button.

    // render new.ejs file
    res.render("new.ejs", {});
  } else {
    if (req.body.hasOwnProperty("user")) {
      // retrieve the id of the user from the request
      let userId = req.body.user;

      // variable that stores the result from the query
      let neededUser;

      try {
        // get the user with id = userId
        neededUser = await db.query(
          `SELECT * FROM ${usersTable} WHERE id = ($1)`,
          [userId]
        );
        console.log("neededUser = ", neededUser);

        // variable that stores the user and will be sent to the ejs file
        // users = neededUser.rows;

        // variable that stores the users and will be sent to the ejs file
        users = await getAllUsers();
      } catch (err) {
        // an error occured
        console.error(
          `\'/user\' POST Route; Error executing query that retrives the user with id = ${userId}: `,
          err.stack
        );
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
          console.error(
            `\'/user\' POST Route; Error executing query that retrieves the countries for user with id = ${userId}: `,
            err.stack
          );
        }

        // the rows returned from the request
        let visitedCountriesByUser = visitedCountriesByUserQuery.rows;

        // clean up the data so that only the country codes will be sent to the EJS file (and not the id generated from postgreSQL)
        let visitedCountries = [];
        visitedCountriesByUser.forEach((val) => {
          visitedCountries.push(val.country_code);
        });

        // set the currentUserId to this user's id
        currentUserId = userId;

        // send the necessary data to the index ejs file
        res.render("index.ejs", {
          countries: visitedCountries,
          total: visitedCountries.length,
          users: users,
          // color: "teal",
          color: retrievedUser.color,
        });
      }
    } else {
      // for some reason, the user's id is not passed in the body of the request
      console.error(
        `\'user\' route eroor: the user's id was not passed in the body of the request`
      );
    }
  }
});

// handles the request once a user clicks the "add" button for a new family member
app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html

  // Debugging
  console.log(`\'/new\' route: req.body = `, req.body);
  let userName = req.body.name;
  let userColor = req.body.color;
  // variable to store the result from the query
  let result;
  // add the user to the users table
  try {
    // RETURNING keyword returns the data that was inserted.
    result = await db.query(
      `INSERT INTO ${usersTable} (name, color) VALUES ($1, $2) RETURNING *`,
      [userName, userColor]
    );

    console.log("result = ", result);

    // variable that stores the users
    // users = await getAllUsers();
  } catch (err) {
    // an error occured
    console.error(
      `\'/new\' POST Route; Error executing query that adds the new user to the database`,
      err.stack
    );
  }

  if (typeof result === "undefined" || result.rowCount !== 1) {
    // error; problem with database because more than 1 user or no user was added to the database
    console.error(
      `Database Error: The ${usersTable} table either added more than 1 user or did not add a user.`
    );
  } else {
    // variable to store the user that gets returned from the database
    let newUser = result.rows[0];
    console.log("newUser = ", newUser);

    // set the currentUserId to the id returned from the db.query
    currentUserId = newUser.id;

    // Redirect to the home page.
    // The home page should now show the new user as a tab
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
