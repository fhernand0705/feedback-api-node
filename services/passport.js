const passport = require('passport');
const keys = require('../config/keys');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = mongoose.model('users');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user); 
})

passport.use(
    new GoogleStrategy({
        clientID: keys.googleClientID,
        clientSecret: keys.googleClientSecret,
        callbackURL: '/auth/google/callback'
    }, 
     async (accessToken, refreshToken, profile, done) => {
        const existingUser = await User.findOne({ googleId: profile.id}); 

        if (existingUser) {
            done(null, existingUser);
        } else {
            // creates model instance using google data
            const newUser = await new User({
                googleId: profile.id,
                name: profile.displayName 
            }).save() // saves record to mongoDB

            done(null, newUser);
        }   
  })
);