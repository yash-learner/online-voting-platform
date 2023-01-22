"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Voter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Voter.belongsTo(models.Election, {
        foreignKey: "electionId",
        onDelete: "CASCADE",
      });
    }

    static addVoter({ voterId, password, electionId }) {
      return this.create({
        voterId: voterId,
        password: password,
        voted: false,
        electionId: electionId,
        voterIdPlusElectionId: voterId + electionId,
      });
    }

    static async getAllVoters(electionId) {
      return Voter.findAll({
        where: {
          electionId: electionId,
        },
        order: [["id", "ASC"]],
      });
    }

    static async getVotersCount(electionId) {
      return Voter.count({
        where: {
          electionId: electionId,
        },
      });
    }

    static async getCastedVotersCount(electionId) {
      return Voter.count({
        where: {
          voted: true,
          electionId: electionId,
        },
      });
    }

    static async updateVotedStatus(voted, id) {
      return await Voter.update(
        { voted: voted },
        {
          where: {
            id,
          },
        }
      );
    }

    static async editVoter(id, voterId, password, voterIdPlusElectionId) {
      console.log("Inside model");
      return await Voter.update(
        {
          voterId: voterId,
          password: password,
          voterIdPlusElectionId: voterIdPlusElectionId,
        },
        {
          where: {
            id,
          },
        }
      );
    }

    static async deleteVoter(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
  }
  Voter.init(
    {
      voterId: DataTypes.STRING,
      password: DataTypes.STRING,
      voted: DataTypes.BOOLEAN,
      electionId: DataTypes.INTEGER,
      voterIdPlusElectionId: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Voter",
    }
  );
  return Voter;
};
