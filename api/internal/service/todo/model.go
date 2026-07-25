package todo

import "go.mongodb.org/mongo-driver/v2/bson"

type Todo struct {
	Id    bson.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Title string        `bson:"title,omitempty" json:"title"`
}
