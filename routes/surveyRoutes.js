const _ = require('lodash');
const { Path } = require('path-parser');
const { URL } = require('url');
const mongoose = require('mongoose');
const requireLogin = require('../middleware/requireLogin');
const requireCredits = require('../middleware/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplates/surveyTemplate');

const Survey = mongoose.model('surveys');


module.exports = app => {
    app.get('/api/surveys', requireLogin, async (req, res) => {
        const surveys = await Survey.find({ _user: req.user.id })
            .select({ recipients: false })
            .sort({ dateSent: -1, lastResponded: -1 });
    
        res.send(surveys);
    })

    app.delete('/api/surveys/:surveyId', requireLogin, async (req, res) => {
        await Survey.findByIdAndDelete({ _id: req.params.surveyId });

        const surveys = await Survey.find({ _user: req.user.id })
            .select({ recipients: false })
            .sort({ dateSent: -1, lastResponded: -1 });

        res.send(surveys);
    })

    app.get('/api/surveys/:surveyId/:choice', (req, res) => {
        res.send('Thanks for your feedback!');
    })

    app.post('/api/surveys/webhooks', (req, res) => {
        const pathExtractor = new Path('/api/surveys/:surveyId/:choice'); 
        
        _.chain(req.body)
            .map(({url, email}) => {
                const match = pathExtractor.test(new URL(url).pathname);
            
                if (match) return { email, ...match }; 
            
            })
            .compact()
            .uniqBy('email', 'surveyId')
            .each(({ surveyId, email, choice}) => {
                Survey.updateOne(
                    {
                        _id: surveyId,
                        recipients: {
                            $elemMatch: { email: email, responded: false }
                        }
                    },     
                    {
                        $inc: { [choice]: 1},
                        $set: { 'recipients.$.responded': true},
                        lastResponded: new Date()
                    }
                ).exec();
            })
            .value();
        
        res.send({});
    })
    
    app.post('/api/surveys', requireLogin, requireCredits, async(req, res) => {
        const { title, subject, body, recipients } = req.body; 

        const survey = new Survey({
            title,
            subject,
            body,
            recipients: recipients.split(',').map(email => ({ email: email.trim() })),
            _user: req.user.id,
            dateSent: Date.now()
        });

        // create instance of Mailer 
        const mailer = new Mailer(survey, surveyTemplate(survey));
        try {
            await mailer.send();  
            await survey.save();
        
            req.user.credits--;
            const user = await req.user.save(); 
        
            res.send(user);
        } catch (error) {
            res.status(422).send(err);
        }
    });
}


