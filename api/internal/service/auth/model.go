package auth

import "go.mongodb.org/mongo-driver/v2/bson"

type User struct {
	Id    bson.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Title string        `bson:"title,omitempty" json:"title"`
}
