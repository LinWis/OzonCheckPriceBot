const dao = require("./dataAccessObject");

module.exports.init_index = async (name) => {
    let res;
    try {
        res = await dao.createIndex(name);
    } catch (error) {
        console.log(error);
    }

    return res
}