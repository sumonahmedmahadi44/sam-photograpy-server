const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();


app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access token' })
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()

    })
    

}






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t9xiucx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("samDb").collection("user");
    const classesCollection = client.db("samDb").collection("classes");

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: '1h' })

        res.send({ token })
    });
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'admin') {
          return res.status(403).send({ error: true, message: 'forbidden message' });
        }
        next();
      }
      const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'instructor') {
          return res.status(403).send({ error: true, message: 'forbidden message' });
        }
        next();
      }


    app.post('/classes', verifyJWT, verifyInstructor,async(req,res)=>{
        const newClass = req.body;
        const result = await classesCollection.insertOne(newClass)
        res.send(result)
    })


    app.get('/users', async (req, res) => {
        const result = await usersCollection.find().toArray();
        
        res.send(result)
    });

    app.post('/users', async (req, res) => {
        const user = req.body;
        
        const query = { email: user.email }
        const existingUser = await usersCollection.findOne(query)
        if (existingUser) {
            return res.send({ message: 'user already exist' })
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    })



app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin' 
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })


        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor' 
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })



        


        app.get('/users/admin/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};

            if(req.decoded.email !== email){
                return res.send({admin : false})
            }
            const user = await usersCollection.findOne(query);
            const result = {admin: user?.role === 'admin'}
            return res.send(result)
        })

        app.get('/users/instructor/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};

            if(req.decoded.email !== email){
                return res.send({admin : false})
            }
            const user = await usersCollection.findOne(query);
            const result = {instructor: user?.role === 'instructor'}
            return res.send(result)
        })





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('sam photgraphy is running')
})



app.listen(port,()=>{
    console.log(`sam is running in th e port ${port}`)
})