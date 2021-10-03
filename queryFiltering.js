const countryFile = require('./countries.json')
const moment = require('moment')
const validCountries = countryFile.countryCodes
const streetOrCityValidator = new RegExp('^[A-Za-z]+$')

function isValidStreetOrCity(streetOrCity)
{
    return (typeof streetOrCity) === 'string' && streetOrCityValidator.test(streetOrCity)
}

function isValidCountry(country)
{
    return validCountries.includes(country)
}

function isValidDate(date)
{
    return (typeof date) === 'string' && moment(date, 'YYYY-MM-DD', true).isValid()
}

function categoryFilter(element)
{
    return this.value.includes(element.category)
}

function locationFilter(element)
{
    return this.value == element.location[this.key]
}

function startDateFilter(element)
{
    return new Date(this.value).getTime() <= element.dateOfPosting.getTime()
}

function endDateFilter(element)
{
    return new Date(this.value).getTime() >= element.dateOfPosting.getTime()
}

module.exports = {
    isValidStreetOrCity,
    isValidCountry,
    isValidDate,
    categoryFilter,
    locationFilter,
    startDateFilter,
    endDateFilter
};
