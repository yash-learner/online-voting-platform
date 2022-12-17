const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const { User } = require("./models");
const passport = require("passport");
const bcrypt = require("bcrypt");
// eslint-disable-next-line no-unused-vars
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const cookieParser = require("cookie-parser");
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser("shh! some secret string"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "my-super-secret-key-7218728182782818218782718hsjahsu8as8a8su88",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hour
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      function (username, password, done) {
        User.findOne({ where: { email: username } })
          .then(async (user) => {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
              return done(null, user);
            } else {
              return done(null, false, { message: "Invalid password" });
            }
          })
          .catch(() => {
            return done(null, false, { message: "Email Id not found" });
          });
      }
    )
  )



passport.serializeUser(function (user, done) {
  console.log("Serializing user in session: ", user.id);
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.get("/signup", (request, response) => {
  response.render("signup");
});

app.get("/login", (request, response) => {
  response.render("login");
});

app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

app.post(
  "/session",
  passport.authenticate("local", { failureRedirect: "/login" }),
  function (request, response) {
    console.log(request.user);
    response.redirect("/elections");
  }
);

const saltRounds = 10;
app.post("/users", async function (request, response) {
  // eslint-disable-next-line no-unused-vars
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hashedPwd);
  try {
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, function (err) {
      if (err) {
        console.log(err);
      }
      return response.redirect("/elections");
    });
  } catch (error) {
    console.log(error);
    request.flash(
      "error",
      error.errors.map((error) => error.message)
    );
    return response.redirect("/signup");
  }
});

app.get("/elections", connectEnsureLogin.ensureLoggedIn(), (request, response) => {
  response.render("elections");
});

app.get("/", function (request, response) {
  response.render("index");
});

module.exports = app;
