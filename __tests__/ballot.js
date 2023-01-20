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
