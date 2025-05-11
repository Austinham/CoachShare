const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AppError = require('../utils/appError');
const errorHandler = require('../middlewares/errorMiddleware');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Error Handling', () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      path: '/api/test',
      method: 'GET'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  test('should handle operational errors in development', () => {
    const error = new AppError('Test error', 400);
    process.env.NODE_ENV = 'development';

    errorHandler(error, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'fail',
      error: error,
      message: 'Test error',
      stack: error.stack
    });
  });

  test('should handle operational errors in production', () => {
    const error = new AppError('Test error', 400);
    process.env.NODE_ENV = 'production';

    errorHandler(error, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Test error'
    });
  });

  test('should handle programming errors in production', () => {
    const error = new Error('Programming error');
    process.env.NODE_ENV = 'production';

    errorHandler(error, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Something went very wrong!'
    });
  });

  test('should handle MongoDB cast errors', () => {
    const error = {
      name: 'CastError',
      path: 'id',
      value: 'invalid-id'
    };
    process.env.NODE_ENV = 'production';

    errorHandler(error, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Invalid id: invalid-id'
    });
  });

  test('should handle JWT errors', () => {
    const error = {
      name: 'JsonWebTokenError'
    };
    process.env.NODE_ENV = 'production';

    errorHandler(error, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Invalid token. Please log in again!'
    });
  });
}); 