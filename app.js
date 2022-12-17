const express = require("express");
const app = express();

app.set("view engine", "ejs");


app.get("/signup", (request, response) => {
    response.render("signup");
})

app.get("/login", (request, response) => {
    response.render("login");
})

app.get("/", function (request, response) {
  response.render("index");
});

module.exports = app;
