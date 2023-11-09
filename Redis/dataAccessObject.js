const { createClient, SchemaFieldTypes} = require('redis');
const { userNotification } = require('../utils/userNotify');

module.exports =  {

    async createIndex(name) {
        const client = await createClient();
        await client.connect();
        try {
            await client.ft.dropIndex(name)
        }
        catch (e) {
            console.log(e)
        }

        let res = await client.ft.create(name,
            {
                userId: {
                    type: SchemaFieldTypes.NUMERIC,
                    sortable: true
                },
                name: SchemaFieldTypes.TEXT,
                url: SchemaFieldTypes.TEXT,
                price: SchemaFieldTypes.NUMERIC
            },

            {
                ON: 'HASH',
                PREFIX: 'NOTIFY:USER'
            }
        );

        await client.quit();
        return res
    },

    async save (userId, name, url, price) {

        const client = await createClient();
        await client.connect();

        let res = await client.hSet(userNotification(userId, name),
            {
                'userId': userId,
                'name': name,
                'url': url,
                'price': price
            });

        await client.quit();
        return res

    },

    async del (userId, name) {

        const client = await createClient();
        await client.connect();
        let res = client.DEL(userNotification(userId, name));

        await client.quit();
        return res
    },

    // delAll (documents) {
    //     const allActiveNotifications = []
    //     documents.forEach(function (document) {
    //         allActiveNotifications.push(redis.DEL((document.id)))
    //     })
    //     return allActiveNotifications
    // },

    async find(attributes) {
        const client = await createClient();
        await client.connect();

        let res = client.ft.search(
            `idx:notification`,

            attributes.reduce(
                (tot, [key, value], idx) => {
                    let res;

                    if (typeof(value) === "number")
                        res = `${tot}${(idx && " ") || ""}@${key}:[${value} ${value}]`
                    else
                        res = `${tot}${(idx && " ") || ""}@${key}:${value}`

                    return res

            }, '')
        )

        await client.quit();
        return res
    },
}
