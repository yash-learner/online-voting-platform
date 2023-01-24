"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Question extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Question.belongsTo(models.Election, {
        foreignKey: "electionId",
        onDelete: "CASCADE",
      });

      Question.hasMany(models.Option, {
        foreignKey: "questionId",
        onDelete: "CASCADE",
      });
    }

    static async getAllQuestions(electionId) {
      return Question.findAll({
        where: {
          electionId: electionId,
        },
        order: [["id", "ASC"]],
      });
    }

    static async editQuestion(id, title, description) {
      return await Question.update(
        { title: title, description: description },
        {
          where: {
            id,
          },
        }
      );
    }

    static async deleteQuestion(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static async checkForAtleastOneQuestion(id) {
      return Question.count({
        where: {
          electionId: id,
        },
      });
    }
  }
  Question.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Question title can not be empty" },
        },
      },
      description: DataTypes.STRING,
      electionId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Question",
    }
  );
  return Question;
};
