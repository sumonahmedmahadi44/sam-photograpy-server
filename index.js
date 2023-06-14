const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access token" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t9xiucx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("samDb").collection("user");
    const classesCollection = client.db("samDb").collection("classes");
    const SelectedClassesCollection = client
      .db("samDb")
      .collection("selectedClasses");
    const paymentCollection = client.db("samDb").collection("payment");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "1h" });

      res.send({ token });
    });
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/classes",verifyJWT,verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes/:email",verifyJWT,verifyInstructor, async (req, res) => {
      const email = req.params.email;
      // console.log(id)
      const filter = { email: email };
      const result = await classesCollection.find(filter).toArray();
      res.send(result);
    });

    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });

    app.get("/singleClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await SelectedClassesCollection.findOne(query);
      res.send(result);
    });

    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await SelectedClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/deleteSelectedClass/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await SelectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/selectedClass",verifyJWT, async (req, res) => {
      const query = req.body;
      const result = await SelectedClassesCollection.insertOne(query);
      res.send(result);
    });

    app.get("/users",verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();

      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/instructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/users/admin/:id",verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id",verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/status/approved/:id",verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/status/denied/:id",verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/homeClass", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection
        .find(query)
        .sort({ enroll: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/approved", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/approved/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      return res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      return res.send(result);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent.client_secret);

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments",verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // app.get("/paymentHistory",verifyJWT, async (req, res) => {
    //   const email = req.query.email;
    //   console.log(email);
    //   if (!email) {
    //     res.send([]);
    //   }
    //   const query = { email: email };
    //   const options = {
    //     sort:{'date':1}
    //   }
    //   const result = await paymentCollection.find(query,options).toArray();
    //   res.send(result);
    // });

    app.get("/payments/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await SelectedClassesCollection.findOne(filter);
      res.send(result);
    });
    

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: new ObjectId(payment.Id),
      };
      const deleteResults = await SelectedClassesCollection.deleteOne(query);

      const filter = {
        _id: new ObjectId(payment.classId),
      };

      const existingClass = await classesCollection.findOne(filter);
      if (existingClass) {
        const seatUpdate = existingClass.AvailableSeat - 1;
        const enrollClass = existingClass.enroll + 1;
        const updateDoc = {
          $set: { AvailableSeat: seatUpdate, enroll: enrollClass },
        };
        const updateResult = await classesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send({ insertResult, deleteResults, updateResult });
      } else {
        res.status(404).send("data not found");
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("sam photgraphy is running");
});

app.listen(port, () => {
  console.log(`sam is running in th e port ${port}`);
});
