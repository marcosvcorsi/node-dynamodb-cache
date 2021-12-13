const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' })

const patientRepository = require('./repository/patient')
const examRepository = require('./repository/exam')
const medicineRepository = require('./repository/medicine')

const dynamoClient = new AWS.DynamoDB.DocumentClient();
const dynamoPatientsTable = 'patients';

const addPatientToCache = patient => {
  const now = Math.round(new Date().getTime() / 1000);

  const minuteInSeconds = 60;

  return dynamoClient.put({
    TableName: dynamoPatientsTable,
    Item: {
      ...patient,
      expiresAt: now + minuteInSeconds,
    },
  }).promise();
}

const getPatientFromCache = patientId => {
  return dynamoClient.get({
    TableName: dynamoPatientsTable,
    Key: {
      id: Number(patientId),
    },
  }).promise()
    .then(({ Item }) => Item)
    .catch(console.error);
}

const getPatientInfo = async patientId => {
    const patientFromCache = await getPatientFromCache(patientId);

    if (patientFromCache) {
      return patientFromCache;
    }

    const patient = await patientRepository.findById(patientId)
    const exams = await examRepository.findAllByPatientId(patientId)
    const medicines = await medicineRepository.findAllByPatientId(patientId)

    const patientData = {
      ...patient.dataValues,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      exams: exams.map(exam => ({
              name: exam.name,
              result: exam.result,
              date: exam.date.toISOString()
          })
      ),
      medicines: medicines.map(medicine =>({
              name: medicine.name,
              date: medicine.date.toISOString()
          })
      ),
    }

    await addPatientToCache(patientData);

    return patientData;
}

module.exports = {
    getPatientInfo
}
