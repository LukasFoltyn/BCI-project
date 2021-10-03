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

app.use(bodyParser.json())

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
const private = require('./private.json')
const secretKey = private.jwtSignKey

const options = {
    jwtFromRequest : ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey : secretKey
}

passport.use(new JwtStrategy(options, (payload, done) => {

    const searchedUser = users.find(user => user.id === payload.userId)
    done(null, searchedUser)

}))


function filterPostings (req, _, next) {

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
    console.log(req.query)
    next()
}


app.post('/users', (req, res) => {

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

app.get('/users/:id', /*passport.authenticate('jwt', { session: false }),*/ (req, res) => {

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

app.put('/users/:id', passport.authenticate('jwt', { session: false }), (req, res) => {

    const user = users.find(user => user.id === req.params.id)
    if(user == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        const salt = bcrypt.genSalt(5)
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
        users.splice(users.indexOf(user), 1, user)
        res.sendStatus(200)
    }

})

app.get('/postings', filterPostings, (req, res) => {

    res.status(200).json(filteredPostings)

})

app.post('/postings', /*passport.authenticate('jwt', { session: false }),*/ (req, res) => {

    const posting = {
        id : uuidv4(),
        dateOfPosting : new Date().toISOString().split('T')[0]
    }

    Object.assign(posting, req.body)
    postings.push(posting)
    res.status(201).json({ id : posting.id })
})

app.get('/postings/:id', (req, res) => {

    const posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        res.status(200).json(posting)
    }
})

app.put('/postings/:id', /*passport.authenticate('jwt', { session: false }),*/ (req, res) => {

    const posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        Object.assign(posting, req.body)
        res.status(200).json({ id : posting.id })
    }
})

app.delete('/postings/:id', passport.authenticate('jwt', { session: false }),(req, res) => {

    const posting = postings.find(posting => posting.id === req.params.id)
    if(posting == undefined)
    {
        res.sendStatus(404)
    }
    else
    {
        postings.splice(users.indexOf(posting), 1, posting)
        res.sendStatus(200)
    }
})


let serverInstance = null

module.exports = {

    start : function(port) {
        serverInstance = app.listen(port, () => {
            console.log(`Example app listening at http://localhost:${port}`)
        })
    },

    close : function() {
        serverInstance.close()
    },
}


