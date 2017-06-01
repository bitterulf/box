'use strict';

const config = require('dotenv').config();

const Hapi = require('hapi');
const fs = require('fs');
const Path = require('path');

const server = new Hapi.Server({
    connections: {
        routes: {
            files: {
                relativeTo: __dirname
            }
        }
    }
});

server.connection({
    host: process.env.BOX_HOST,
    port: process.env.BOX_PORT
});

server.register([require('hapi-auth-basic'), require('inert')], (err) => {
    server.auth.strategy('simple', 'basic', { validateFunc: function (request, username, password, callback) {
        if (username == process.env.BOX_USERNAME && password == process.env.BOX_PASSWORD) {
            return callback(null, true, {});
        }
        callback(null, false, {});
    }});

    server.route({
        method: 'POST',
        path:'/'+process.env.BOX_UPLOAD_ROUTE,
        config: {
            auth: 'simple',
            payload: {
                output: 'stream',
                parse: true,
                allow: 'multipart/form-data'
            },
            handler: function (request, reply) {
                const data = request.payload;
                if (data.file) {
                    const name = data.file.hapi.filename;
                    const path = __dirname + "/uploads/" + name;
                    const file = fs.createWriteStream(path);

                    file.on('error', function (err) {
                        console.error(err)
                    });

                    data.file.pipe(file);

                    data.file.on('end', function (err) {
                        const ret = {
                            filename: data.file.hapi.filename,
                            headers: data.file.hapi.headers
                        }
                        reply(JSON.stringify(ret));
                    })
                }
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/files.json',
        config: {
            handler: function (request, reply) {
                fs.readdir(__dirname + "/uploads", function(err, result) {
                    reply(result.filter(function(fileName) {
                        return fileName != '.gitignore';
                    }));
                });
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/files/{param*}',
        config: {
            handler: {
                directory: {
                    path: './uploads',
                    redirectToSlash: true,
                    index: true
                }
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/{param*}',
        config: {
            auth: 'simple',
            handler: {
                directory: {
                    path: './public',
                    redirectToSlash: true,
                    index: true
                }
            }
        }
    });

    server.start((err) => {
        if (err) {
            throw err;
        }
        console.log('Server running at:', server.info.uri);
    });
});
