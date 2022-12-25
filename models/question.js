'use strict';
const {
  Model
} = require('sequelize');
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
    }

    static async getAllQuestions(electionId) {
      return Question.findAll({
        where: {
          electionId: electionId
        }
      })
    }

  }
  Question.init({
    title: DataTypes.STRING,
    description: DataTypes.STRING,
    electionId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Question',
  });
  return Question;
};