const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");
const { User, Election, Question, Option, Voter } = require("./models");
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
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "/public")));
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
);

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

app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user;
    const liveElections = await Election.live(loggedInUser.id);
    const upcoming = await Election.upcoming(loggedInUser.id);
    const completed = await Election.completed(loggedInUser.id);
    console.log(upcoming);
    if (request.accepts("html")) {
      response.render("elections", { liveElections, upcoming, completed });
    } else {
      response.json({ liveElections, upcoming, completed });
    }
  }
);

app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("creating new election :", request.body);
    console.log("User Id:", request.user.id);
    try {
      // eslint-disable-next-line no-unused-vars
      const election = await Election.createElection({
        name: request.body.electionName,
        userId: request.user.id,
      });
      return response.redirect(`/elections/${election.id}`);
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);



app.get("/elections/:id", async (request, response) => {
  console.log("election id :", request.params.id);
  try {
    const election = await Election.findByPk(request.params.id);
    const questions = await Question.getAllQuestions(election.id);
    const voters = await Voter.getAllVoters(election.id);
    response.render("electionIndex", { election: election, questions: questions, voters: voters });
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.get(`/elections/:id/questions/new`, async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  return response.render("newQuestion", {election:election})
})

app.post("/questions", async (request, response) => {
  try {
    await Question.create({
      title: request.body.title,
      description: request.body.description,
      electionId: request.body.electionId
    });
    return response.redirect(`/elections/${request.body.electionId}`)
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.get(`/elections/:id/questions/:questionId`, async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  const question = await Question.findByPk(request.params.questionId);
  const options = await Option.getOptions(request.params.questionId);
  console.log(options, "Options");
  return response.render("questionIndex", {election: election, question: question, options: options});
});

app.get(`/elections/:id/questions/:id/options/new`, async (request, response) => {
  response.render("newOption",)
});

app.get("/elections/:electionId/questions/:questionId/options/:id", async (request, response) => {
  console.log(request.params.electionId);
  const election = await Election.findByPk(request.params.electionId);
  const question = await Question.findByPk(request.params.questionId);
  const option = await Option.findByPk(request.params.id);
  console.log(election, question, option);
  return response.render("editOption",{election: election, question: question, option: option});
})

app.put("/options/:id", async (request, response) => {
  try {
    console.log(request.body.title,request.body.electionId,request.body.questionId);
    await Option.editTitle(request.params.id, request.body.title);
    // return response.send(200);
    return response.redirect(`/elections/${request.body.electionId}/questions/${request.body.questionId}`);
  } catch (error) {
    return response.status(422).json(error);
  }
})

app.delete("/questions/:id", async (request, response) => {
  connectEnsureLogin.ensureLoggedIn();
  try {
    await Question.deleteQuestion(request.params.id);
    return response.json(true);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.delete("/options/:id", async (request, response) => {
  connectEnsureLogin.ensureLoggedIn();
  try {
    await Option.deleteOption(request.params.id);
    return response.json(true);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.post("/options", async (request, response) => {
  try {
    await Option.create({
      title: request.body.title,
      questionId: request.body.questionId
    })
    console.log("Option Added",request.body.electionId );
    response.redirect(`/elections/${request.body.electionId}/questions/${request.body.questionId}`)
  } catch (error) {
    return response.status(422).json(error);
  }
})

app.get("/elections/:electionId/questions/:id/edit", async (request, response) => {
  const election = await Election.findByPk(request.params.electionId);
  const question = await Question.findByPk(request.params.id);
  response.render("editQuestion", {election, question});
})

app.put("/questions/:id", async (request, response) => {
  try {
    await Question.editQuestion(request.params.id, request.body.title, request.body.description);
  } catch (error) {
    return response.status(422).json(error);
  }
})

app.get("/elections/new", (request, response) => {
  return response.render("newElection");
});

app.delete("/elections/:id", async (request, response) => {
  connectEnsureLogin.ensureLoggedIn();
  try {
    await Election.deleteElection(request.params.id, request.user.id);
    return response.json(true);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.post("/voters", async (request, response) => {
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(request.body);
  try {
    await Voter.addVoter({
      voterId: request.body.voterId,
      password: hashedPwd,
      electionId: request.body.electionId
    })
    console.log("Voter Added",request.body.electionId );
    response.redirect(`/elections/${request.body.electionId}/`)
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.get("/elections/:id/preview", async (request, response) => {
  // Lazy loading
  const election = await Election.findByPk(request.params.id);
  const questions = await Question.getAllQuestions(election.id);
  console.log(election,questions)
  let options = {}
  for(let i = 0; i < questions.length; i++){
    let questionOptions = await Option.getOptions(questions[i].id);
    options[i] = questionOptions;
  }
  // console.log(options);
  // console.log(options);
  // console.log(options['1'][0].title);
  // console.log(options['1'].length);
  // console.log(options[1]);
  // console.log(Option);
  return response.render("preview", {questions:questions, election:election, options: options});
})

app.get("/", function (request, response) {
  return response.render("index");
});

module.exports = app;
