"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Election.belongsTo(models.User, {
        foreignKey: "userId",
        onDelete: "CASCADE",
      });

      Election.hasMany(models.Question, {
        foreignKey: "electionId",
      });

      Election.hasMany(models.Voter, {
        foreignKey: "electionId",
      });
    }

    static createElection({ name, userId }) {
      return this.create({
        electionName: name,
        userId,
      });
    }



    static async allElections(userId) {
      const elections = await Election.findAll();
      return elections;
    }

    static async live(userId) {
      const elections = await Election.findAll({
        where: {
          userId,
          status: true,
        },
        order: [["id", "ASC"]],
      });
      return elections;
    }

    static async upcoming(userId) {
      const elections = await Election.findAll({
        where: {
          userId,
          status: null,
        },
        order: [["id", "ASC"]],
      });
      return elections;
    }

    static async completed(userId) {
      const elections = await Election.findAll({
        where: {
          userId,
          status: false,
        },
        order: [["id", "ASC"]],
      });
      return elections;
    }

    static async deleteElection(id, userId) {
      return this.destroy({
        where: {
          id,
          userId,
        },
      });
    }

    static async launchElection({id, userId}) {
      return await Election.update(
        { status: true },
        {
          where: {
            id,
            userId
          },
        }
      );
    }

    static async endElection({id, userId}) {
      return await Election.update(
        { status: false },
        {
          where: {
            id,
            userId
          },
        }
      );
    }
  }
  Election.init(
    {
      electionName: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
      userId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
