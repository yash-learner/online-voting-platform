"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Option extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Option.belongsTo(models.Question, {
        foreignKey: "questionId",
        onDelete: "CASCADE",
      });
    }
    static async getOptions(questionId) {
      const options = Option.findAll({
        where: {
          questionId,
        },
      });
      return options;
    }

    static async getOptionsForResults(questionId) {
      const options = Option.findAll({
        where: {
          questionId,
        },
        order: [["count", "DESC"]],
      });
      return options;
    }
    static async editTitle(id, title) {
      option = await Option.update(
        { title: title },
        {
          where: {
            id,
          },
        }
      );
      console.log(option);
    }

    static async checkForAtleastTwoOptions(id) {
      return Option.count({
        where: {
          questionId: id,
        },
      });
    }

    static async updateOptionCount(optionId) {
      console.log("Inside model", optionId);
      const option = await Option.findByPk(optionId);
      return await option.increment("count", { by: 1 });
    }

    static async deleteOption(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
  }
  Option.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Option title can not be empty" },
        },
      },
      questionId: DataTypes.INTEGER,
      count: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Option",
    }
  );
  return Option;
};
