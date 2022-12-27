'use strict';
const {
  Model
} = require('sequelize');
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
        voterIdPlusElectionId: voterId+electionId
      });
    }

    static async getAllVoters(electionId) {
      return Voter.findAll({
        where: {
          electionId: electionId
        },
        order: [["id", "ASC"]],
      });
    }
  }
  Voter.init({
    voterId: DataTypes.STRING,
    password: DataTypes.STRING,
    voted: DataTypes.BOOLEAN,
    electionId: DataTypes.INTEGER,
    voterIdPlusElectionId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Voter',
  });
  return Voter;
};