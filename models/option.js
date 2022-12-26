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
  }
  Option.init(
    {
      title: DataTypes.STRING,
      questionId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Option",
    }
  );
  return Option;
};
