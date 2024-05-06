import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Ticket } from '../ticket/entities/ticket.entity'; // Importa el modelo de Ticket
import { Push } from '../push/entities/push.entity'; // Importa el modelo de Push
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import { ValidRoles } from './enums/valid-roles.enum';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';

describe('UserService', () => {
  let service: UserService;
  let userModelMock: Model<User>;
  let ticketModelMock: Model<Ticket>; // Agrega una instancia de Ticket Model Mock
  let pushModelMock: Model<Push>; // Agrega una instancia de Push Model Mock
  let jwtServiceMock: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        JwtService,
        {
          provide: getModelToken(User.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
            exec: jest.fn(),
          },
        },
        {
          provide: getModelToken(Ticket.name), // Agrega un proveedor para el modelo de Ticket
          useValue: {
            find: jest.fn(),
            exec: jest.fn(),
          },
        },
        {
          provide: getModelToken(Push.name), // Agrega un proveedor para el modelo de Push
          useValue: {
            find: jest.fn(),
            exec: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModelMock = module.get<Model<User>>(getModelToken(User.name));
    ticketModelMock = module.get<Model<Ticket>>(getModelToken(Ticket.name)); // Obtén la instancia del modelo de Ticket
    pushModelMock = module.get<Model<Push>>(getModelToken(Push.name)); // Obtén la instancia del modelo de Push
    jwtServiceMock = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
        const createUserDto: CreateUserDto = {
            email: '',
            password: '',
            name: '',
            roles: []
        };
        const createdUser = {}; // Set your expected created user object
        jest.spyOn(userModelMock, 'create').mockResolvedValue(createdUser as any);
      
        const result = await service.create(createUserDto);
      
        expect(userModelMock.create).toHaveBeenCalledWith(createUserDto);
        expect(result).toEqual(createdUser);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      // Mock pagination parameters
        const paginationDto = {
        limit: 10,
        offset: 0,
      };

      // Mock list of users
        const userList = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
        // Add more user objects as needed
      ];

      // Mock the UserModel's find method to return the user list
      jest.spyOn(userModelMock, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValueOnce(userList),
            }),
        }),
        }),
      } as any);


      // Call the service method
      const result = await service.findAll(paginationDto);

      // Verify that UserModel's find method was called with the correct parameters
      expect(userModelMock.find).toHaveBeenCalledWith();
      expect(userModelMock.find().sort).toHaveBeenCalledWith({ name: 1 });
      expect(userModelMock.find().sort().skip).toHaveBeenCalledWith(0);

      // Verify that the result matches the expected user list
      expect(result).toEqual(userList);
    });
  });
  
  describe('findOne', () => {
    it('should find a user by ID', async () => {
      // Mock user ID
      const userId = '1';
  
      // Mock user object
      const user = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
      };
  
      // Mock UserModel's findById method to return the user
      jest.spyOn(userModelMock, 'findById').mockResolvedValue(user as any);
  
      // Call the service method
      const result = await service.findOne(userId);
  
      // Verify that UserModel's findById method was called with the correct parameter
      expect(userModelMock.findById).toHaveBeenCalledWith(userId);
  
      // Verify that the result matches the expected user
      expect(result).toEqual(user);
    });
  
    it('should find a user by email', async () => {
      // Mock user email
      const userEmail = 'john@example.com';
    
      // Mock user object
      const user = {
        id: '1',
        name: 'John Doe',
        email: userEmail,
      };
    
      // Define a custom mock function for findOne
      const findOneMock = jest.fn().mockImplementation((conditions) => {
        if (conditions.email === userEmail.toLowerCase().trim()) {
          return Promise.resolve(user as any);
        } else {
          return Promise.resolve(null);
        }
      });
    
      // Mock UserModel's findOne method with the custom mock function
      jest.spyOn(userModelMock, 'findOne').mockImplementation(findOneMock);
    
      // Call the service method
      const result = await service.findOne(userEmail);
    
      // Verify that UserModel's findOne method was called with the correct parameter
      expect(userModelMock.findOne).toHaveBeenCalledWith({ email: userEmail.toLowerCase().trim() });
    
      // Verify that the result matches the expected user
      expect(result).toEqual(user);
    });    
  
    it('should throw NotFoundException when user is not found', async () => {
      // Mock user ID
      const userId = '1';
  
      // Mock UserModel's findById method to return null, simulating user not found
      jest.spyOn(userModelMock, 'findById').mockResolvedValue(null);
  
      // Call the service method and expect it to throw NotFoundException
      await expect(service.findOne(userId)).rejects.toThrowError(NotFoundException);
    });
  });  
});

