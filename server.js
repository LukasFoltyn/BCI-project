const { v4: uuidv4 } = require('uuid');
const express = require('express')
const bodyParser = require('body-parser')
const {
    isValidStreetOrCity,
    isValidCountry,
    isValidDate,
    categoryFilter,
    locationFilter,
    startDateFilter,
    endDateFilter } = require('./queryFiltering')


const bcrypt = require('bcryptjs')

const app = express()

// if the application or tests are needed to be run, the port
// has to be changed to 3000
app.set('port',(process.env.PORT || 80))

app.use(bodyParser.json())

const Ajv = require('ajv')
const ajv_user = new Ajv()
const ajv_posting = new Ajv()

const userSchema = require('./validation_schemas/userSchema.json')
const userSchemaValidator = ajv_user.compile(userSchema)

const postingSchema = require('./validation_schemas/postingSchema.json')
const postingSchemaValidator = ajv_posting.compile(postingSchema)


var users = []
var postings = []
var filteredPostings = []

/* HTTP Basic authentication */

const passport = require('passport')
const BasicStrategy = require('passport-http').BasicStrategy

passport.use(new BasicStrategy(
    (email, password, done) => {
        const searchedUser = users.find(user => user.email === email && bcrypt.compareSync(password, user.password))
        if(searchedUser === undefined)
        {
            done(null, false);
        }
        else
        {
            done(null, searchedUser);
        }
    }
))


/* JWT authentication */
const jwt = require('jsonwebtoken')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt

/*only for localhost
const private = require('./private.json')
const secretKey = private.jwtSignKey */

const options = {
    jwtFromRequest : ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey : 'randomSecretKey'
}

passport.use(new JwtStrategy(options, (payload, done) => {

    const searchedUser = users.find(user => user.id === payload.userId)
    done(null, searchedUser)

}))

/* Custom middlewares */

function filterPostings (req, res, next) {

    filteredPostings = postings

    const possibleQueryParameters = [
        { paramName : 'categories', validatorIndex : 0, filterIndex : 0 },
        { paramName : 'street', validatorIndex : 1, filterIndex : 1 },
        { paramName : 'city', validatorIndex : 1, filterIndex : 1 },
        { paramName : 'country', validatorIndex : 2, filterIndex : 1 },
        { paramName : 'dateOfPostingStart', validatorIndex : 3, filterIndex : 2},
        { paramName : 'dateOfPostingEnd', validatorIndex : 3, filterIndex : 3}
    ]
    const queryValidators = [ Array.isArray, isValidStreetOrCity,  isValidCountry, isValidDate ]
    const filterFunctions = [ categoryFilter, locationFilter, startDateFilter, endDateFilter ]

    possibleQueryParameters.forEach( element => {
        if(element.paramName in req.query && queryValidators[element.validatorIndex](req.query[element.paramName]))
        {
            filteredPostings = filteredPostings.filter(filterFunctions[element.filterIndex],
                 { value : req.query[element.paramName], key : element.paramName } )
        }
    })
    next()
}

function validateUserMiddleware(req, res, next) {

    const validUser = userSchemaValidator(req.body)
    if(validUser)
    {
        next()
    }
    else
    {
        const propertyPath = userSchemaValidator.errors[0].instancePath.split('/')
        let error = userSchemaValidator.errors[0].message

        if(propertyPath[0] != userSchemaValidator.errors[0].instancePath)
        {
            error = propertyPath[propertyPath.length -1] + ' ' +  error
        }

        res.status(400).json({ errorDescription : error })
    }
}

function validatePostingMiddleware (req, res, next) {

    const validPosting = postingSchemaValidator(req.body)
    if(validPosting)
    {
        next()
    }
    else
    {
        const propertyPath = postingSchemaValidator.errors[0].instancePath.split('/')
        let error = postingSchemaValidator.errors[0].message

        if(propertyPath[0] != postingSchemaValidator.errors[0].instancePath)
        {
            error = propertyPath[propertyPath.length -1] + ' ' +  error
        }
        res.status(400).json({ errorDescription : error })
    }
}

/* Image processing */

const fs = require('fs')

function imageToBase64(imagePaths){

    let imagesBase64 = []

    for(const imagePath of imagePaths)
    {
        data = fs.readFileSync(imagePath)
        imagesBase64.push(Buffer.from(data, 'binary').toString('base64'))
    }
    return imagesBase64
}

function base64toImage(images){

    let pathsToImgs = []

    for(const base64image of images)
    {
        const pathToImg = 'uploads/' + uuidv4() + '.png'
        fs.writeFile(pathToImg, Buffer.from(base64image, 'base64'), function(err){
            if(err){
                console.error(err)
            }
        })
        pathsToImgs.push(pathToImg)
    }
    return pathsToImgs
}

function deepCopyImagesPosting(posting)
{
    let deepCopiedImagesPosting = {}
    for(const property in posting)
    {
        if(property != 'images')
        {
            deepCopiedImagesPosting[property] = posting[property]
        }
    }
    deepCopiedImagesPosting.images = [...posting.images]
    return deepCopiedImagesPosting
}

/* API routes */

app.post('/users', validateUserMiddleware, (req, res) => {

    const salt = bcrypt.genSaltSync(5)
    const hashedPassword = bcrypt.hashSync(req.body.password, salt)

    const user = {
        id : uuidv4(),
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        dateOfBirth : req.body.dateOfBirth,
        address : {
            street : req.body.address.street,
            city : req.body.address.city,
            country : req.body.address.country
        },
        email : req.body.email,
        password : hashedPassword
    }

    users.push(user)
    res.status(201).json({id: user.id})
})


app.post('/login', passport.authenticate('basic', { session : false }), (req, res) => {

    const token = jwt.sign({ userId : req.user.id }, secretKey)

    res.json({ token : token })

})

app.get('/users/:id', passport.authenticate('jwt', { session: false }), (req, res) => {

    const user = users.find(user => user.id === req.params.id)
    if(user == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        returnedUser = Object.assign({}, user)
        delete returnedUser.password
        res.status(200).json(returnedUser)
    }
})

app.put('/users/:id', validateUserMiddleware, passport.authenticate('jwt', { session: false }), (req, res) => {

    const user = users.find(user => user.id === req.params.id)
    if(user == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        const salt = bcrypt.genSaltSync(5)
        const hashedPassword = bcrypt.hashSync(req.body.password, salt)

        user.firstName = req.body.firstName
        user.lastName = req.body.lastName
        user.dateOfBirth = req.body.dateOfBirth,
        user.address.street = req.body.address.street,
        user.address.city = req.body.address.city,
        user.address.country = req.body.address.country
        user.email = req.body.email,
        user.password = hashedPassword

        res.status(200).json({ id : user.id })
    }
})

app.delete('/users/:id', passport.authenticate('jwt', { session: false }), (req, res) => {

    const user = users.find(user => user.id === req.params.id)
    if(user == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        users.splice(users.indexOf(user), 1)
        res.sendStatus(200)
    }

})

app.get('/postings', filterPostings, (req, res) => {

    filteredPostings.forEach((posting,index, arr) => {
        arr[index] = deepCopyImagesPosting(posting)
        arr[index].images = imageToBase64(posting.images)
        delete arr[index].userId
    })
    res.status(200).json({ data : filteredPostings })

})

app.post('/postings', validatePostingMiddleware, passport.authenticate('jwt', { session: false }), (req, res) => {

    const posting = {
        id : uuidv4(),
        userId : req.user.id,
        dateOfPosting : new Date().toISOString().split('T')[0]
    }

    Object.assign(posting, req.body)
    posting.images = base64toImage(posting.images)
    postings.push(posting)
    res.status(201).json({ id : posting.id })
})

app.get('/postings/:id', (req, res) => {

    let posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        posting = deepCopyImagesPosting(posting)
        posting.images = imageToBase64(posting.images)
        delete posting.userId
        res.status(200).json(posting)
    }
})

app.put('/postings/:id', validatePostingMiddleware, passport.authenticate('jwt', { session: false }), (req, res) => {

    const posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    // user is not allowed to to modify postings of others
    else if(posting.userId != req.user.id)
    {
        res.sendStatus(401)
    }
    else
    {
        //delete the stored images
        posting.images.forEach(imagePath => fs.unlinkSync(imagePath))
        Object.assign(posting, req.body)
        posting.images = base64toImage(posting.images)
        res.status(200).json({ id : posting.id })
    }
})

app.delete('/postings/:id', passport.authenticate('jwt', { session: false }),(req, res) => {

    const posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    // user is not allowed to to modify postings of others
    else if(posting.userId != req.user.id)
    {
        res.sendStatus(401)
    }
    else
    {
        // delete the stored images
        posting.images.forEach(imagePath => fs.unlinkSync(imagePath))
        postings.splice(postings.indexOf(posting), 1)
        res.sendStatus(200)
    }
})


let serverInstance = null

module.exports = {

    start : function() {
        serverInstance = app.listen(app.get('port'), () => {})
    },

    close : function() {
        serverInstance.close()
    },
}


