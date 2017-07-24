# Alexa Skill: Bus Stop NYC

The goal of this Alexa skill is to be able to ask Alexa where is my bus. The skill should tell you when the next two buses from your bus stop are.

Example:
- Question: Alexa, ask Bus NYC where is my bus?
- Answer: The next M7 is 2 stops away and the next one is 5 minutes away.

The data are fetched from the MTA api.

## How to deploy the skill

First you need to install the dependencies.

> npm install

The skill is an AWS lambda function.

The `node_modules` folder and the `index.js` file need to be packaged into a zip file and uploaded into an AWS lambda function.

Then go to the Alexa skill developer portal and follow the setup and link your skill with the lambda function previously created.

## TODO

- Create unit tests
- Fix setup voice interaction to pass Alexa certification
