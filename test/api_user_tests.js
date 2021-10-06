const chai = require('chai')
const expect = chai.expect

const chaiHttp = require('chai-http')
const chaiJsonSchemaAjv = require('chai-json-schema-ajv')

const server = require('../server')
const userSeedData = require('./user_seed_data.json')


chai.use(chaiHttp)
chai.use(chaiJsonSchemaAjv)

const idSchema = require('../validation_schemas/idSchema.json')
const errorDescriptionSchema = require('../validation_schemas/errorDescriptionSchema')
const userSchemaGET = require('../validation_schemas/userSchemaGET.json')
const jwtSchema = require('../validation_schemas/jwtSchema.json')

let validUserIds = []
let jsonWebToken = null

const baseUrl = 'http://localhost:3030'

describe('User requests', function() {

    before(function () {
        server.start(3030)
        // create 2 users before running the tests
        userSeedData.validUsers.forEach(function(user) {
            chai.request(baseUrl)
                .post('/users')
                .send(user)
                .then(res => validUserIds.push(res.body.id))
            })
        // login the first user
        chai.request(baseUrl)
            .post('/login')
            .auth( userSeedData.validUsers[0].email, userSeedData.validUsers[0].password)
            .then(res =>  jsonWebToken = res.body.token)
    })

    after(function () {
      server.close()
    })

  describe('POST rquest - creating new user', function() {
    it('should successfully create user with status 201 and return his id', function(done) {
        chai.request(baseUrl)
            .post('/users')
            .send(userSeedData.validUsers[0])
            .end(function(err, res) {
                expect(err).to.be.null
                expect(res).to.have.status(201)
                expect(res.body).to.be.jsonSchema(idSchema)
                done()
            })
        });
    it('should reject the request because of missing property', function(done) {
            chai.request(baseUrl)
            .post('/users')
            .send(userSeedData.invalidUsers[0])
            .end(function(err, res) {
                expect(res).to.have.status(400)
                expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                done()
            })
        });
    it('should reject the request because of wrong type of the property', function(done) {
            chai.request(baseUrl)
            .post('/users')
            .send(userSeedData.invalidUsers[1])
            .end(function(err, res) {
                expect(res).to.have.status(400)
                expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                done()
            })
        });
    });

    describe('GET a particular user by id', function () {
        it('should successfully return a user', function (done) {
            chai.request(baseUrl)
                .get('/users/' + validUserIds[1])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function(err, res){
                    expect(err).to.be.null
                    expect(res).to.have.status(200)
                    expect(res.body).to.be.jsonSchema(userSchemaGET)
                    done()
                })
        });
        it('should failed to return a user because of non existing id', function (done) {
            chai.request(baseUrl)
                .get('/users/nonExistingId')
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function (err, res) {
                    expect(res).to.have.status(404)
                    expect(res.body).to.be.empty
                    done()
                })

        });
    });
    describe('DELETE a particular user by id', function () {
        it('should successfully delete a user', function (done) {
            chai.request(baseUrl)
                .delete('/users/' + validUserIds[0])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function(err, res){
                    expect(res).to.have.status(200)
                    done()
                })
        });
        it('should failed to delete a user because of non existing id', function (done) {
            chai.request(baseUrl)
                .delete('/users/nonExistingId')
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function (err, res) {
                    expect(res).to.have.status(404)
                    done()
                })

        });
    });
    describe('UPDATE a particular user by id', function () {
        it('should successfully update a user and return his id', function (done) {
            chai.request(baseUrl)
                .put('/users/' + validUserIds[1])
                .send(userSeedData.validUsers[0])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function(err, res){
                    expect(res).to.have.status(200)
                    expect(res.body).to.be.jsonSchema(idSchema)

                    // get the updated user and check if really updated
                    chai.request(baseUrl)
                        .get('/users/' + res.body.id)
                        .auth(jsonWebToken, { type: 'bearer' })
                        .then(res =>
                            expect(res.body).to.equal(userSeedData.validUsers[0]))

                    done()
                })
        });
        it('should failed to update a user because of non existing id', function (done) {
            chai.request(baseUrl)
                .put('/users/nonExistingId')
                .send(userSeedData.validUsers[0])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function (err, res) {
                    expect(res).to.have.status(404)
                    done()
                })

        });
        it('should failed to update a user because of type error in request property', function (done) {
            chai.request(baseUrl)
                .put('/users/nonExistingId')
                .send(userSeedData.invalidUsers[0])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function (err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
                })

        });
        it('should failed to update a user because of missing request property', function (done) {
            chai.request(baseUrl)
                .put('/users/nonExistingId')
                .send(userSeedData.invalidUsers[1])
                .auth(jsonWebToken, { type: 'bearer' })
                .end(function (err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
                })
        });
    });
    describe('LOGIN user', function () {

        before(function (){
            chai.request(baseUrl)
                .post('/users')
                .send(userSeedData.validUsers[1])
                .then(res => {})
        })

        it('should successfully login user and return jwt token', function (done) {
            chai.request(baseUrl)
            .post('/login')
            .auth( userSeedData.validUsers[1].email, userSeedData.validUsers[1].password)
            .end(function(err, res){
                expect(res).to.have.status(200)
                expect(res.body).to.be.jsonSchema(jwtSchema)
                done()
            })
        });
        it('should faile to login because of wrong password', function (done) {
            chai.request(baseUrl)
            .post('/login')
            .auth('wrongEmail', userSeedData.validUsers[1].password)
            .end(function(err, res){
                expect(res).to.have.status(401)
                expect(res.body).to.be.empty
                done()
            })
        });
        it('should faile to login because of wrong email', function (done) {
            chai.request(baseUrl)
            .post('/login')
            .auth( userSeedData.validUsers[1].email, 'wrongPassword')
            .end(function(err, res){
                expect(res).to.have.status(401)
                expect(res.body).to.be.empty
                done()
            })
        });
    });
});
