/* eslint-disable no-undef */
const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

// eslint-disable-next-line no-unused-vars
let server, agent;

// get csrf
const extractCsrfToken = (res) => {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
};

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Voting application tests", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Election admin sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Election admin sign out", async () => {
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
  });
  //                                         Election Tests
  test("Create a new Election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    const res = await agent.get("/elections");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/elections").send({
      _csrf: csrfToken,
      electionName: "Class Monitor",
    });
    expect(response.statusCode).toBe(302);
  });

  test("Update the election name", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/elections");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      _csrf: csrfToken,
      electionName: "Class Monitor V2",
    });

    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);

    expect(parsedGroupedResponse.upcoming).toBeDefined();

    const upcomingElectionsCount = parsedGroupedResponse.upcoming.length;
    const latestElection =
      parsedGroupedResponse.upcoming[upcomingElectionsCount - 1];

    res = await agent.get("/elections");
    csrfToken = extractCsrfToken(res);

    await agent.put(`/elections/${latestElection.id}/`).send({
      _csrf: csrfToken,
      id: latestElection.id,
      title: "Cricket Venue",
    });
    const updatedGroupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedUpdatedGroupedResponse = JSON.parse(
      updatedGroupedElectionsResponse.text
    );
    console.log(parsedUpdatedGroupedResponse.upcoming);
    expect(parsedUpdatedGroupedResponse.upcoming).toBeDefined();
    expect(
      parsedUpdatedGroupedResponse.upcoming[upcomingElectionsCount - 1]
        .electionName
    ).toBe("Cricket Venue");
  });

  test("Add question to the election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/elections");
    let csrfToken = extractCsrfToken(res);

    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);

    expect(parsedGroupedResponse.upcoming).toBeDefined();

    const upcomingElectionsCount = parsedGroupedResponse.upcoming.length;
    const latestElection =
      parsedGroupedResponse.upcoming[upcomingElectionsCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/`);
    csrfToken = extractCsrfToken(res);

    const response = await agent.post(`/questions`).send({
      _csrf: csrfToken,
      title: "Question 1",
      description:
        "Which country should be venue for Ind vs Pak match for upcoming ICC T20 World Cup",
      electionId: latestElection.id,
    });

    expect(response.statusCode).toBe(302);
  });

  test("Add option to the question", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/elections");
    let csrfToken = extractCsrfToken(res);

    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);

    expect(parsedGroupedResponse.upcoming).toBeDefined();

    const upcomingElectionsCount = parsedGroupedResponse.upcoming.length;
    const latestElection =
      parsedGroupedResponse.upcoming[upcomingElectionsCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/questions/1`);
    csrfToken = extractCsrfToken(res);

    // Adding option 1 to question 1
    const response = await agent.post(`/options`).send({
      _csrf: csrfToken,
      title: "West Indies",
      questionId: 1,
    });
    expect(response.statusCode).toBe(302);
    const questionGroupResponse = await agent
      .get(`/elections/${latestElection.id}/questions/1`)
      .set("Accept", "application/json");
    const parsedQuestionGroupResponse = JSON.parse(questionGroupResponse.text);
    expect(parsedQuestionGroupResponse.options).toBeDefined();
    console.log(parsedQuestionGroupResponse.options, "Options");
    expect(parsedQuestionGroupResponse.options[0].title).toBe("West Indies");

    res = await agent.get(`/elections/${latestElection.id}/questions/1`);
    csrfToken = extractCsrfToken(res);
    // Adding option 2 to question 1
    const responseForOption2 = await agent.post(`/options`).send({
      _csrf: csrfToken,
      title: "United States Of America",
      questionId: 1,
    });
    expect(responseForOption2.statusCode).toBe(302);
    const questionGroupResponse2 = await agent
      .get(`/elections/${latestElection.id}/questions/1`)
      .set("Accept", "application/json");
    const parsedQuestionGroupResponse2 = JSON.parse(
      questionGroupResponse2.text
    );
    expect(parsedQuestionGroupResponse2.options).toBeDefined();
    console.log(parsedQuestionGroupResponse2.options, "Options");
    expect(parsedQuestionGroupResponse2.options[1].title).toBe(
      "United States Of America"
    );
  });

  test("Add voter to the election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/elections");
    let csrfToken = extractCsrfToken(res);

    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);

    expect(parsedGroupedResponse.upcoming).toBeDefined();

    const upcomingElectionsCount = parsedGroupedResponse.upcoming.length;
    const latestElection =
      parsedGroupedResponse.upcoming[upcomingElectionsCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/`);
    csrfToken = extractCsrfToken(res);

    // Adding first voter
    const response = await agent.post(`/voters`).send({
      _csrf: csrfToken,
      voterId: "ABCD",
      password: "12345678",
      electionId: latestElection.id,
    });
    expect(response.statusCode).toBe(302);
    const electionGroupResponse = await agent
      .get(`/elections/${latestElection.id}/`)
      .set("Accept", "application/json");
    const parsedElectionGroupResponse = JSON.parse(electionGroupResponse.text);
    expect(parsedElectionGroupResponse.voters).toBeDefined();
    console.log(parsedElectionGroupResponse.voters, "Voters");
    expect(parsedElectionGroupResponse.voters[0].voterId).toBe("ABCD");

    res = await agent.get(`/elections/${latestElection.id}/`);
    csrfToken = extractCsrfToken(res);

    // Adding second voter
    const response2 = await agent.post(`/voters`).send({
      _csrf: csrfToken,
      voterId: "ABCD1",
      password: "12345678",
      electionId: latestElection.id,
    });
    expect(response2.statusCode).toBe(302);
    const electionGroupResponse2 = await agent
      .get(`/elections/${latestElection.id}/`)
      .set("Accept", "application/json");
    const parsedElectionGroupResponse2 = JSON.parse(
      electionGroupResponse2.text
    );
    expect(parsedElectionGroupResponse2.voters).toBeDefined();
    console.log(parsedElectionGroupResponse2.voters, "Voters");
    expect(parsedElectionGroupResponse2.voters[1].voterId).toBe("ABCD1");
  });

  test("Delete the election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/elections");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      _csrf: csrfToken,
      electionName: "Election to be deleted",
    });

    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);

    expect(parsedGroupedResponse.upcoming).toBeDefined();

    const upcomingElectionsCount = parsedGroupedResponse.upcoming.length;
    const latestElection =
      parsedGroupedResponse.upcoming[upcomingElectionsCount - 1];

    res = await agent.get("/elections");
    csrfToken = extractCsrfToken(res);

    const deleteResponse = await agent
      .delete(`/elections/${latestElection.id}/`)
      .send({
        _csrf: csrfToken,
      });

    const parsedDeleteResponse = JSON.parse(deleteResponse.text);
    expect(parsedDeleteResponse).toBe(true);
  });
});
