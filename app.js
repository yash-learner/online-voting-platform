const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");
const { User, Election, Question, Option, Voter } = require("./models");
const cookieParser = require("cookie-parser");
const csrf = require("tiny-csrf");
const passport = require("passport");
const bcrypt = require("bcrypt");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const saltRounds = 10;
const flash = require("connect-flash");

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "/public")));
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));

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

app.use(flash());
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

passport.use(
  "admin-local",
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

passport.use(
  "voter-local",
  new LocalStrategy(
    {
      usernameField: "voterId",
      passwordField: "password",
      passReqToCallback: true,
    },
    function (request, username, password, done) {
      console.log(request.params.id);
      Voter.findOne({
        where: { voterId: username, electionId: request.params.id },
      })
        .then(async (voter) => {
          const result = await bcrypt.compare(password, voter.password);
          if (result) {
            return done(null, voter);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Voter not found" });
        });
    }
  )
);

passport.serializeUser(function (user, done) {
  console.log("Serializing user in session: ", user.id);
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  console.log(user, "dese");
  done(null, user);
});

app.get("/signup", (request, response) => {
  response.render("signup", { csrfToken: request.csrfToken() });
});

app.get("/login", (request, response) => {
  response.render("login", { csrfToken: request.csrfToken() });
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
  passport.authenticate("admin-local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
    console.log(request.user);
    response.redirect("/elections");
  }
);

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

const checkElectionAuthenticated = async (request, response, next) => {
  const election = await Election.findByPk(request.params.id);
  if (request.isAuthenticated() && election.userId === request.user.id) {
    return next();
  } else if (
    request.isAuthenticated() &&
    election.userId !== request.user.id &&
    request.user.electionId === undefined
  ) {
    return response.redirect("/elections");
  } else if (
    request.isAuthenticated() &&
    request.user.electionId === election.id
  ) {
    return response.redirect(`/elections/${election.id}/vote`);
  }
  return response.redirect("/");
};

app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const userName = request.user.firstName;
    const loggedInUser = request.user;
    const liveElections = await Election.live(loggedInUser.id);
    const upcoming = await Election.upcoming(loggedInUser.id);
    const completed = await Election.completed(loggedInUser.id);
    console.log(upcoming);
    if (request.accepts("html")) {
      response.render("elections", {
        liveElections,
        upcoming,
        completed,
        userName,
        csrfToken: request.csrfToken(),
      });
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

app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  checkElectionAuthenticated,
  async (request, response) => {
    console.log("election id :", request.params.id);
    try {
      const election = await Election.findByPk(request.params.id);
      const questions = await Question.getAllQuestions(election.id);
      const voters = await Voter.getAllVoters(election.id);
      if (request.accepts("html")) {
        response.render("electionIndex", {
          election: election,
          questions: questions,
          voters: voters,
          userName: request.user.firstName,
          csrfToken: request.csrfToken(),
        });
      } else {
        response.json({
          election,
          questions,
          voters,
        });
      }
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.get(
  `/elections/:id/questions/new`,
  checkElectionAuthenticated,
  async (request, response) => {
    const election = await Election.findByPk(request.params.id);
    return response.render("newQuestion", { election: election });
  }
);

app.post("/questions", async (request, response) => {
  try {
    await Question.create({
      title: request.body.title,
      description: request.body.description,
      electionId: request.body.electionId,
    });
    return response.redirect(`/elections/${request.body.electionId}`);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.get(`/elections/:id/questions/:questionId`, async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  const question = await Question.findByPk(request.params.questionId);
  const options = await Option.getOptions(request.params.questionId);
  console.log(options, "Options");
  if (request.accepts("html")) {
    return response.render("questionIndex", {
      election: election,
      question: question,
      options: options,
      userName: request.user.firstName,
      csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      election,
      question,
      options,
    });
  }
});

app.get(
  `/elections/:id/questions/:id/options/new`,
  async (request, response) => {
    response.render("newOption", { userName: request.user.firstName });
  }
);

app.get(
  "/elections/:electionId/questions/:questionId/options/:id",
  async (request, response) => {
    console.log(request.params.electionId);
    const election = await Election.findByPk(request.params.electionId);
    const question = await Question.findByPk(request.params.questionId);
    const option = await Option.findByPk(request.params.id);
    console.log(election, question, option);
    return response.render("editOption", {
      election: election,
      question: question,
      option: option,
      userName: request.user.firstName,
      csrfToken: request.csrfToken(),
    });
  }
);

app.put(
  "/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      console.log(
        request.body.title,
        request.body.electionId,
        request.body.questionId
      );
      await Option.editTitle(request.params.id, request.body.title);
      // return response.send(200);
      return response.redirect(
        `/elections/${request.body.electionId}/questions/${request.body.questionId}`
      );
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Question.deleteQuestion(request.params.id);
      return response.json(true);
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Option.deleteOption(request.params.id);
      return response.json(true);
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.post("/options", async (request, response) => {
  try {
    await Option.create({
      title: request.body.title,
      questionId: request.body.questionId,
      count: 0,
    });
    console.log("Option Added", request.body.electionId);
    response.redirect(
      `/elections/${request.body.electionId}/questions/${request.body.questionId}`
    );
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.get(
  "/elections/:electionId/questions/:id/edit",
  async (request, response) => {
    const election = await Election.findByPk(request.params.electionId);
    const question = await Question.findByPk(request.params.id);
    response.render("editQuestion", {
      election,
      question,
      userName: request.user.firstName,
      csrfToken: request.csrfToken(),
    });
  }
);

app.get("/elections/:id/edit", async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  response.render("editElectionName", {
    election,
    userName: request.user.firstName,
    csrfToken: request.csrfToken(),
  });
});

app.put("/elections/:id", async (request, response) => {
  try {
    console.log("update election name", request.body.title);
    await Election.editElectionName(
      request.params.id,
      request.body.title,
      request.user.id
    );
    return response.redirect(`/elections`);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.put("/questions/:id", async (request, response) => {
  try {
    await Question.editQuestion(
      request.params.id,
      request.body.title,
      request.body.description
    );
  } catch (error) {
    return response.status(422).json(error);
  }
});

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
      electionId: request.body.electionId,
    });
    console.log("Voter Added", request.body.electionId);
    response.redirect(`/elections/${request.body.electionId}/`);
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.delete(
  "/voters/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Voter.deleteVoter(request.params.id);
      return response.json(true);
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.get(
  "/elections/:id/preview",
  checkElectionAuthenticated,
  async (request, response) => {
    const election = await Election.findByPk(request.params.id);
    const questions = await Question.getAllQuestions(election.id);
    console.log(election, questions);
    let options = {};
    for (let i = 0; i < questions.length; i++) {
      let questionOptions = await Option.getOptions(questions[i].id);
      options[i] = questionOptions;
    }
    return response.render("preview", {
      questions: questions,
      election: election,
      options: options,
      csrfToken: request.csrfToken(),
    });
  }
);

app.post(
  "/elections/start/",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log(request.user.id, "UserId");
    const id = request.body.id;
    const questionCount = await Question.checkForAtleastOneQuestion(id);
    console.log(questionCount, "Count flash");
    if (questionCount < 1) {
      console.log("Inside Flash");
      request.flash("error", "The Ballot should have atleast one question.");
      return response.redirect(`/elections/${id}`);
    }
    const questions = await Question.getAllQuestions(id);
    for (let i = 0; i < questions.length; i++) {
      let options = await Option.getOptions(questions[i].id);
      if (options.length < 2) {
        console.log("Inside Flash");
        request.flash(
          "error",
          "Each question in the ballot should have atleast two Options"
        );
        return response.redirect(`/elections/${id}`);
      }
    }

    await Election.launchElection({
      id: id,
      userId: request.user.id,
      status: request.body.status,
    });
    console.log("election is launched");
    return response.redirect(`/elections/${id}`);
  }
);

app.post(
  "/elections/end/",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log(request.user.id, "UserId");
    await Election.endElection({
      id: request.body.id,
      userId: request.user.id,
      status: request.body.status,
    });
    console.log("election is launched");
    return response.redirect(`/elections/${request.body.id}/vote`);
  }
);

app.get("/elections/:id/voter-login", async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  return response.render("voterLogin", {
    election,
    csrfToken: request.csrfToken(),
  });
});

app.post(
  "/elections/:id/voter-login",
  passport.authenticate("voter-local", {
    failureRedirect: "back",
    failureFlash: true,
  }),
  function (request, response) {
    console.log("Hello", request.user);
    response.redirect(`/elections/${request.params.id}/vote`);
  }
);

const checkAuthenticated = async (request, response, next) => {
  const election = await Election.findByPk(request.params.id);
  if (election.status === true && request.isAuthenticated()) {
    return next();
  } else if (election.status === false) {
    return next();
  }
  response.redirect(`/elections/${request.params.id}/voter-login`);
};

app.get(
  "/elections/:id/vote/",
  checkAuthenticated,
  async function (request, response) {
    const election = await Election.findByPk(request.params.id);
    const questions = await Question.getAllQuestions(election.id);
    const votersCount = await Voter.getVotersCount(election.id);
    const castedVotersCount = await Voter.getCastedVotersCount(election.id);
    console.log(election, questions);
    console.log(request.user, "Hello");
    let options = {};
    for (let i = 0; i < questions.length; i++) {
      let questionOptions = await Option.getOptionsForResults(questions[i].id);
      options[i] = questionOptions;
    }
    if (election.status === false) {
      return response.render("publicResult", {
        questions: questions,
        election: election,
        options: options,
        votersCount,
        castedVotersCount,
        csrfToken: request.csrfToken(),
      });
    }
    const voter = await Voter.findByPk(request.user.id);
    if (
      voter.voted === true &&
      election.status === true &&
      request.accepts("html")
    ) {
      return response.render("vote", {
        voter: voter,
        election: election,
        csrfToken: request.csrfToken(),
      });
    } else if (voter.voted === true && election.status === true) {
      return response.json({
        election,
        voter,
      });
    }

    if (request.accepts("html")) {
      return response.render("vote", {
        questions: questions,
        election: election,
        options: options,
        voter: request.user,
        csrfToken: request.csrfToken(),
      });
    } else {
      return response.json({
        election,
        voter,
        csrfToken: request.csrfToken(),
      });
    }
  }
);

app.post(
  "/elections/:id/vote",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log(request.body, "request");
    const election = await Election.findByPk(request.params.id);
    console.log("Options votes", request.body);
    const votes = Object.values(request.body);
    votes.pop(); // pops out csrf token
    const options = votes.map((count) => parseInt(count));
    console.log(options);
    for (let i = 0; i < options.length; i++) {
      await Option.updateOptionCount(options[i]);
      const option = await Option.findByPk(options[i]);
      console.log("Option count", option.count);
    }
    await Voter.updateVotedStatus(true, request.user.id);
    return response.redirect(`/elections/${election.id}/vote`);
  }
);

app.get("/elections/:id/results", async (request, response) => {
  const election = await Election.findByPk(request.params.id);
  const questions = await Question.getAllQuestions(election.id);
  const votersCount = await Voter.getVotersCount(election.id);
  const castedVotersCount = await Voter.getCastedVotersCount(election.id);
  let options = {};
  for (let i = 0; i < questions.length; i++) {
    let questionOptions = await Option.getOptionsForResults(questions[i].id);
    options[i] = questionOptions;
  }
  response.render("results", {
    election,
    questions,
    options,
    userName: request.user.firstName,
    votersCount,
    castedVotersCount,
    csrfToken: request.csrfToken(),
  });
});

app.get("/", function (request, response) {
  if (request.user === undefined) {
    return response.render("index", { csrfToken: request.csrfToken() });
  } else {
    response.redirect("/elections");
  }
});

module.exports = app;
