[![Build Status](https://travis-ci.org/RobertWHurst/Merlin.svg?branch=es6)](https://travis-ci.org/RobertWHurst/Merlin)

## Merlin ORM

Merlin is an ORM (Object Relational Mapper) designed for the flexablity and preformance needed when creating large scale applications. Merlin's major advatages include a database driver interface, enabling you to use and database you like, a plugin interface, allowing to to extend or modify any aspect of the ORM with plugins, and a streaming CRUD interface.

# Examples

## Basic Find
```javascript
Customer.find({ ... }, function(err, customers) {
    ...
});
```

## Streaming Find
```javascript
var stream = Customer.find({ ... });

stream.forEach(function(err, customer) { ... });
// OR
stream.pipe(outStream);
```

## Basic Insert
```javascript
Customer.insert([ { ... }, ... ], function(err, customers) {
    ...
});
```

## Streaming Insert
```javascript
inStream.pipe(Customer.insert()).pipe(outStream);
```
