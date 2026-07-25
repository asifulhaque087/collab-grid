package todo

import (
	"context"

	"github.com/asifulhaque087/todo-go-lang/internal/db"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Repo struct {
	client *mongo.Client
}

func NewRepo(client *mongo.Client) *Repo {
	return &Repo{
		client: client,
	}
}

func (r *Repo) Create(ctx context.Context, title string) (*Todo, error) {

	newTodo := Todo{
		Title: title,
	}

	var todoCollection *mongo.Collection = db.OpenCollection("todos", r.client)

	result, err := todoCollection.InsertOne(ctx, newTodo)

	if err != nil {
		return nil, err
	}

	if oid, ok := result.InsertedID.(bson.ObjectID); ok {
		newTodo.Id = oid
	}

	return &newTodo, nil
}

func (r *Repo) FindById(ctx context.Context, todoId string) (*Todo, error) {
	// 1. err is declared and initialized here
	objID, err := bson.ObjectIDFromHex(todoId)
	if err != nil {
		return nil, err
	}

	var todoCollection *mongo.Collection = db.OpenCollection("todos", r.client)
	var data Todo

	// 2. Use '=' because 'err' already exists.
	// 3. Remove the '_,' because Decode only returns an error.
	err = todoCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&data)

	if err != nil {
		return nil, err
	}

	return &data, nil
}

func (r *Repo) FindAll(ctx context.Context) (*[]Todo, error) {

	var todoCollection *mongo.Collection = db.OpenCollection("todos", r.client)

	cursor, err := todoCollection.Find(ctx, bson.D{})

	if err != nil {
		return nil, err
	}

	defer cursor.Close(ctx)

	var todos []Todo

	if err = cursor.All(ctx, &todos); err != nil {
		return nil, err
	}

	return &todos, nil
}
