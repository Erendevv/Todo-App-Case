﻿using AutoMapper;
using Todo_App.Application.Common.Mappings;
using Todo_App.Domain.Entities;

namespace Todo_App.Application.TodoLists.Queries.GetTodos;

public class TodoItemDto : IMapFrom<TodoItem>
{
    public int Id { get; set; }

    public int ListId { get; set; }

    public string? Title { get; set; }

    public bool Done { get; set; }

    public int Priority { get; set; }
    public string Tags { get; set; }
    public bool isVisible { get; set; }
    public bool isDeleted { get; set; }
    public int Color { get; set; }

    public string? Note { get; set; }

    public void Mapping(Profile profile)
    {
        profile.CreateMap<TodoItem, TodoItemDto>()
            .ForMember(d => d.Priority, opt => opt.MapFrom(s => (int)s.Priority))
             .ForMember(d => d.Color, opt => opt.MapFrom(s => (int)s.Color))
             .ForMember(d => d.isDeleted, opt => opt.MapFrom(s => s.IsDeleted));
    }
}
