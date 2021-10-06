const chai = require('chai')
const expect = chai.expect

const chaiHttp = require('chai-http')
const chaiJsonSchemaAjv = require('chai-json-schema-ajv')

const server = require('../server')
const userSeedData = require('./user_seed_data.json')
const postingSeedData =require('./posting_seed_data.json')


chai.use(chaiHttp)
chai.use(chaiJsonSchemaAjv)

const postingSchemaGETarray = require('../validation_schemas/postingSchemaGETArray.json')
const postingSchemaGET = require('../validation_schemas/postingSchemaGET.json')
const errorDescriptionSchema = require('../validation_schemas/errorDescriptionSchema')
const idSchema = require('../validation_schemas/idSchema')

let validPostingIds = []
let jsonWebTokens = []

const baseUrl = 'http://localhost:3030'

describe('Posting requests', function() {

    before(function () {

        server.start(3030)

        // create 2 users
        userSeedData.validUsers.forEach(user => {
            chai.request(baseUrl)
                .post('/users')
                .send(user)
                .then(function (_) {

                    // get theirs jwt for authorization
                    chai.request(baseUrl)
                    .post('/login')
                    .auth( user.email, user.password)
                    .then(function(res){
                        jsonWebTokens.push(res.body.token)

                        // create 3 new postings for every user
                        postingSeedData.validPostings.forEach(posting => {
                        chai.request(baseUrl)
                        .post('/postings')
                        .send(posting)
                        .auth(res.body.token, { type : 'bearer'})
                        .then( res => validPostingIds.push(res.body.id))
                     });
                });
            });
        });
    });

    after(function () {
        server.close()
    })

    describe('GET request - get all the postings', function() {
        it('should successfully return all the available postings', function(done) {
            chai.request(baseUrl)
                .get('/postings')
                .end(function(err, res) {
                    expect(err).to.be.null
                    expect(res).to.have.status(200)
                    expect(res.body).to.be.jsonSchema(postingSchemaGETarray)
                    done()
            });
        });
        it('should successfully return all the postings where the city is Oulu and street is Tutkijantie', function(done) {
            chai.request(baseUrl)
                .get('/postings?city=Oulu&street=Tutkijantie')
                .end(function(err, res) {
                    expect(res.body.data.length).to.equal(2)
                    done()
            });
        });
        it('should successfully return all the postings where the country is Oulu and category is furniture', function(done) {
            chai.request(baseUrl)
                .get('/postings?country=FIN&categories[]=furniture')
                .end(function(err, res) {
                    expect(res.body.data.length).to.equal(4)
                    done()
            });
        });
        it('should successfully return all the postings where category is computers or electronics', function(done) {
            chai.request(baseUrl)
                .get('/postings?categories[]=computers&categories[]=electronics')
                .end(function(err, res) {
                    expect(res.body.data.length).to.equal(4)
                    done()
            });
        });
        //This test will work until 2030-01-01, then the created postings will be out of date boundaries
        it('should successfully return all the postings which were created after 2015 and before 2030', function(done) {
            chai.request(baseUrl)
                .get('/postings?dateOfPostingStart=2015-01-01&dateOfPostingEnd=2030-01-01')
                .end(function(err, res) {
                    expect(res.body.data.length).to.equal(6)
                    done()
            });
        });
        it('should not return anything because end date is 2018', function(done) {
            chai.request(baseUrl)
                .get('/postings?dateOfPostingEnd=2018-01-01')
                .end(function(err, res) {
                    expect(res.body.data).to.be.empty
                    done()
            });
        });
    });
    describe('POST request - create new posting', function() {
        it('should successfully create a new posting and return its id', function(done) {
            chai.request(baseUrl)
                .post('/postings')
                .send(postingSeedData.validPostings[0])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(err).to.be.null
                    expect(res).to.have.status(201)
                    expect(res.body).to.be.jsonSchema(idSchema)
                    done()
            });
        });
        it('should fail to create posting because of authorization', function(done) {
            chai.request(baseUrl)
                .post('/postings')
                .send(postingSeedData.validPostings[0])
                .end(function(err, res) {
                    expect(res).to.have.status(401)
                    done()
            });
        });
        it('should fail to create posting because of type error in property', function(done) {
            chai.request(baseUrl)
                .post('/postings')
                .send(postingSeedData.invalidPostings[0])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
        it('should fail to create posting because of missing property', function(done) {
            chai.request(baseUrl)
                .post('/postings')
                .send(postingSeedData.invalidPostings[1])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
        it('should fail to create posting because of number of allowed pictures was exceeded', function(done) {
            chai.request(baseUrl)
                .post('/postings')
                .send(postingSeedData.invalidPostings[2])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
    });
    describe('GET request - get one particular posting', function() {
        it('should successfully return a posting specified with id', function(done) {
            chai.request(baseUrl)
                .get('/postings/' + validPostingIds[0])
                .end(function(err, res) {
                    expect(err).to.be.null
                    expect(res).to.have.status(200)

                    expect(res.body).to.be.jsonSchema(postingSchemaGET)
                    done()
                });
        });
        it('should return Not Found status because of non existing id', function(done) {
            chai.request(baseUrl)
                .get('/postings/nonExistingId')
                .end(function(err, res) {
                    expect(res).to.have.status(404)
                    expect(res.body).to.be.empty
                    done()
                });
        });
    });
    describe('PUT request - update a particular posting', function() {
        it('should update a posting specified with id and then return its id', function(done) {
            chai.request(baseUrl)
                .put('/postings/' + validPostingIds[0])
                .send(postingSeedData.validPostings[1])
                .auth(jsonWebTokens[0], { type : 'bearer' })
                .end(function(err, res) {
                    expect(res).to.have.status(200)
                    expect(res.body).to.be.jsonSchema(idSchema)

                    chai.request(baseUrl)
                        .get('/postings/' + validPostingIds[0])
                        .end(function(err, res){
                            expect(res.body.location.street).to.equal(postingSeedData.validPostings[1].location.street)
                        });
                    done()
                });
        });
        it('should return Not Found status because of non existing id', function(done) {
            chai.request(baseUrl)
                .put('/postings/nonExistingId')
                .send(postingSeedData.validPostings[1])
                .auth(jsonWebTokens[0], { type : 'bearer' })
                .end(function(err, res) {
                    expect(res).to.have.status(404)
                    expect(res.body).to.be.empty
                    done()
                });
        });
        it('should reject the request because of missing authorization', function(done) {
            chai.request(baseUrl)
                .put('/postings/'+ validPostingIds[0])
                .send(postingSeedData.validPostings[1])
                .end(function(err, res) {
                    expect(res).to.have.status(401)
                    expect(res.body).to.be.empty
                    done()
                });
        });
        it('should reject the request when user tries to modify postings of others', function(done) {
            chai.request(baseUrl)
                .put('/postings/'+ validPostingIds[0])
                .send(postingSeedData.validPostings[1])
                .auth(jsonWebTokens[1], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(401)
                    expect(res.body).to.be.empty
                    done()
                });
        });
        it('should fail to update posting because of type error in property', function(done) {
            chai.request(baseUrl)
                .put('/postings/' + validPostingIds[1])
                .send(postingSeedData.invalidPostings[0])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
        it('should fail to update posting because of missing property', function(done) {
            chai.request(baseUrl)
                .put('/postings/' + validPostingIds[0])
                .send(postingSeedData.invalidPostings[1])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
        it('should fail to update posting because of number of allowed pictures was exceeded', function(done) {
            chai.request(baseUrl)
                .put('/postings/' + validPostingIds[1])
                .send(postingSeedData.invalidPostings[2])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(400)
                    expect(res.body).to.be.jsonSchema(errorDescriptionSchema)
                    done()
            });
        });
    });
    describe('DELETE request - delete a particular posting', function(){
        it('should successfully delete a posting', function(done){
            chai.request(baseUrl)
                .delete('/postings/' + validPostingIds[0])
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(err).to.be.null
                    expect(res).to.have.status(200)
                    done()
                });
        });
        it('should reject request when user tries to delete postings of others', function(done){
            chai.request(baseUrl)
                .delete('/postings/' + validPostingIds[1])
                .auth(jsonWebTokens[1], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(401)
                    done()
                });
        });
        it('should fail to delete a posting because of non existing id', function(done){
            chai.request(baseUrl)
                .delete('/postings/nonExistingId')
                .auth(jsonWebTokens[0], { type : 'bearer'})
                .end(function(err, res) {
                    expect(res).to.have.status(404)
                    done()
                });
        });
        it('should reject to delete a posting because of failed authorization', function(done){
            chai.request(baseUrl)
                .delete('/postings/' + validPostingIds[1])
                .end(function(err, res) {
                    expect(res).to.have.status(401)
                    done()
                });
        });
    });
});
